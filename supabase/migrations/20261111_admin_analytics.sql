-- ==============================================================================
-- ZÉCHA! PICKUP — ADMIN ANALYTICS MIGRATION
-- Migration: 20261111_admin_analytics.sql
-- Description: Indexes and high-performance server-side aggregation functions
--              for /admin/analytics (Sales, Peak Hours, Kitchen Speed, Best Items,
--              Bought Together, and Repeat Customers).
-- Note: All time calculations use 'Asia/Kolkata' (IST).
-- ==============================================================================

-- 1. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_orders_created_at 
  ON public.orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_outlet_created_at 
  ON public.orders (outlet_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status 
  ON public.orders (status);

CREATE INDEX IF NOT EXISTS idx_orders_customer_phone 
  ON public.orders (customer_phone);

-- Composite index for kitchen speed analytics
CREATE INDEX IF NOT EXISTS idx_orders_kitchen_timestamps 
  ON public.orders (paid_at, ready_at) 
  WHERE paid_at IS NOT NULL AND ready_at IS NOT NULL;


-- ==============================================================================
-- 2. TAB 1: SALES ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_sales(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_duration interval;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_current_kpis record;
  v_prev_kpis record;
  v_daily_breakdown jsonb;
  v_outlet_breakdown jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- Duration of selected range for previous period comparison
  v_duration := p_end_date - p_start_date;
  v_prev_end := p_start_date;
  v_prev_start := p_start_date - v_duration;

  -- A) Current Period KPI Aggregation
  SELECT
    COALESCE(SUM(total), 0)::numeric AS total_revenue,
    COUNT(*)::int AS total_orders,
    COALESCE(AVG(total), 0)::numeric AS avg_order_value,
    COALESCE(SUM(
      (SELECT COALESCE(SUM(COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1)), 0)
       FROM jsonb_array_elements(orders.items) AS item)
    ), 0)::bigint AS items_sold
  INTO v_current_kpis
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- B) Previous Period KPI Aggregation
  SELECT
    COALESCE(SUM(total), 0)::numeric AS total_revenue,
    COUNT(*)::int AS total_orders,
    COALESCE(AVG(total), 0)::numeric AS avg_order_value,
    COALESCE(SUM(
      (SELECT COALESCE(SUM(COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1)), 0)
       FROM jsonb_array_elements(orders.items) AS item)
    ), 0)::bigint AS items_sold
  INTO v_prev_kpis
  FROM public.orders
  WHERE created_at >= v_prev_start AND created_at < v_prev_end
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- C) Daily Breakdown (IST calendar dates, including 0-order days)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.day, 'YYYY-MM-DD'),
      'formatted_date', to_char(d.day, 'DD Mon YYYY'),
      'orders', COALESCE(agg.orders_count, 0),
      'revenue', COALESCE(agg.revenue, 0),
      'avg_order_value', CASE WHEN COALESCE(agg.orders_count, 0) > 0 THEN ROUND(agg.revenue / agg.orders_count, 2) ELSE 0 END
    ) ORDER BY d.day ASC
  )
  INTO v_daily_breakdown
  FROM (
    SELECT generate_series(
      date_trunc('day', p_start_date AT TIME ZONE 'Asia/Kolkata'),
      date_trunc('day', p_end_date AT TIME ZONE 'Asia/Kolkata'),
      '1 day'::interval
    ) AS day
  ) d
  LEFT JOIN (
    SELECT
      date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS order_day,
      COUNT(*) AS orders_count,
      SUM(total) AS revenue
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
  ) agg ON d.day = agg.order_day;

  -- D) Outlet Breakdown (when All Outlets is selected)
  IF p_outlet_id IS NULL THEN
    SELECT jsonb_agg(
      jsonb_build_object(
        'outlet_id', ot.id,
        'outlet_name', ot.name,
        'orders', COALESCE(agg.orders_count, 0),
        'revenue', COALESCE(agg.revenue, 0),
        'share_percentage', CASE 
          WHEN v_current_kpis.total_revenue > 0 THEN 
            ROUND((COALESCE(agg.revenue, 0) / v_current_kpis.total_revenue) * 100, 1)
          ELSE 0 
        END
      ) ORDER BY COALESCE(agg.revenue, 0) DESC
    )
    INTO v_outlet_breakdown
    FROM public.outlets ot
    LEFT JOIN (
      SELECT
        outlet_id,
        COUNT(*) AS orders_count,
        SUM(total) AS revenue
      FROM public.orders
      WHERE created_at >= p_start_date AND created_at <= p_end_date
        AND status = ANY(v_valid_statuses)
      GROUP BY outlet_id
    ) agg ON ot.id = agg.outlet_id;
  ELSE
    v_outlet_breakdown := '[]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'revenue', v_current_kpis.total_revenue,
      'revenue_prev', v_prev_kpis.total_revenue,
      'orders', v_current_kpis.total_orders,
      'orders_prev', v_prev_kpis.total_orders,
      'avg_order_value', ROUND(v_current_kpis.avg_order_value, 2),
      'avg_order_value_prev', ROUND(v_prev_kpis.avg_order_value, 2),
      'items_sold', v_current_kpis.items_sold,
      'items_sold_prev', v_prev_kpis.items_sold
    ),
    'daily', COALESCE(v_daily_breakdown, '[]'::jsonb),
    'outlets', COALESCE(v_outlet_breakdown, '[]'::jsonb)
  );
END;
$$;


-- ==============================================================================
-- 3. TAB 2: PEAK HOURS ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_peak_hours(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_grid jsonb;
  v_hourly jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- 7 x 24 Heat Grid (Weekday: 1=Monday to 7=Sunday; Hour: 0 to 23 in IST)
  SELECT jsonb_agg(
    jsonb_build_object(
      'day_of_week', grid.dow,          -- 1=Mon, 2=Tue, ..., 7=Sun
      'day_name', grid.day_name,        -- 'Mon', 'Tue', ...
      'hour', grid.h,                   -- 0 to 23
      'hour_label', CASE 
        WHEN grid.h = 0 THEN '12 AM'
        WHEN grid.h < 12 THEN grid.h || ' AM'
        WHEN grid.h = 12 THEN '12 PM'
        ELSE (grid.h - 12) || ' PM'
      END,
      'orders', COALESCE(ord.cnt, 0),
      'revenue', COALESCE(ord.rev, 0)
    ) ORDER BY grid.dow ASC, grid.h ASC
  )
  INTO v_grid
  FROM (
    SELECT 
      d.dow,
      CASE d.dow
        WHEN 1 THEN 'Mon'
        WHEN 2 THEN 'Tue'
        WHEN 3 THEN 'Wed'
        WHEN 4 THEN 'Thu'
        WHEN 5 THEN 'Fri'
        WHEN 6 THEN 'Sat'
        WHEN 7 THEN 'Sun'
      END AS day_name,
      h.h
    FROM generate_series(1, 7) AS d(dow)
    CROSS JOIN generate_series(0, 23) AS h(h)
  ) grid
  LEFT JOIN (
    SELECT
      EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS dow,
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS h,
      COUNT(*) AS cnt,
      SUM(total) AS rev
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY 
      EXTRACT(ISODOW FROM created_at AT TIME ZONE 'Asia/Kolkata'),
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
  ) ord ON grid.dow = ord.dow AND grid.h = ord.h;

  -- Combined Hourly Bar Chart across all days (0 to 23)
  SELECT jsonb_agg(
    jsonb_build_object(
      'hour', h.hour_num,
      'hour_label', CASE 
        WHEN h.hour_num = 0 THEN '12 AM'
        WHEN h.hour_num < 12 THEN h.hour_num || ' AM'
        WHEN h.hour_num = 12 THEN '12 PM'
        ELSE (h.hour_num - 12) || ' PM'
      END,
      'orders', COALESCE(ord.cnt, 0),
      'revenue', COALESCE(ord.rev, 0)
    ) ORDER BY h.hour_num ASC
  )
  INTO v_hourly
  FROM generate_series(0, 23) AS h(hour_num)
  LEFT JOIN (
    SELECT
      EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int AS hour_num,
      COUNT(*) AS cnt,
      SUM(total) AS rev
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')
  ) ord ON h.hour_num = ord.hour_num;

  RETURN jsonb_build_object(
    'grid', COALESCE(v_grid, '[]'::jsonb),
    'hourly', COALESCE(v_hourly, '[]'::jsonb)
  );
END;
$$;


-- ==============================================================================
-- 4. TAB 3: KITCHEN SPEED ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_kitchen_speed(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_paid_orders int;
  v_measured_orders int;
  v_avg_paid_to_ready numeric;
  v_pct_within_20 numeric;
  v_avg_making_sec numeric;
  v_avg_packaging_sec numeric;
  v_slowest_order record;
  v_daily_trend jsonb;
  v_slowest_10 jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- Total paid orders in range
  SELECT COUNT(*) INTO v_total_paid_orders
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- Measured orders where paid_at and ready_at both exist and ready_at >= paid_at
  SELECT
    COUNT(*)::int AS measured_count,
    COALESCE(AVG(EXTRACT(EPOCH FROM (ready_at - paid_at))), 0) AS avg_duration_sec,
    COALESCE(
      ROUND(
        (COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (ready_at - paid_at)) <= 1200)::numeric / NULLIF(COUNT(*), 0)) * 100, 
        1
      ), 
      0
    ) AS pct_within_20,
    COALESCE(
      AVG(
        CASE 
          WHEN making_at IS NOT NULL AND packaging_at IS NOT NULL AND packaging_at >= making_at
            THEN EXTRACT(EPOCH FROM (packaging_at - making_at))
          WHEN paid_at IS NOT NULL AND packaging_at IS NOT NULL AND packaging_at >= paid_at
            THEN EXTRACT(EPOCH FROM (packaging_at - paid_at))
          ELSE NULL 
        END
      ), 0
    ) AS avg_making_sec,
    COALESCE(
      AVG(
        CASE 
          WHEN packaging_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at >= packaging_at
            THEN EXTRACT(EPOCH FROM (ready_at - packaging_at))
          ELSE NULL 
        END
      ), 0
    ) AS avg_packaging_sec
  INTO 
    v_measured_orders,
    v_avg_paid_to_ready,
    v_pct_within_20,
    v_avg_making_sec,
    v_avg_packaging_sec
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND paid_at IS NOT NULL 
    AND ready_at IS NOT NULL 
    AND ready_at >= paid_at
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- Single slowest order
  SELECT 
    id,
    pickup_code,
    ROUND(EXTRACT(EPOCH FROM (ready_at - paid_at)) / 60.0, 1) AS minutes
  INTO v_slowest_order
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND paid_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at >= paid_at
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
  ORDER BY (ready_at - paid_at) DESC
  LIMIT 1;

  -- Daily average speed trend (IST dates)
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', to_char(d.day, 'YYYY-MM-DD'),
      'formatted_date', to_char(d.day, 'DD Mon'),
      'avg_minutes', COALESCE(ROUND(agg.avg_sec / 60.0, 1), 0),
      'measured_orders', COALESCE(agg.cnt, 0)
    ) ORDER BY d.day ASC
  )
  INTO v_daily_trend
  FROM (
    SELECT generate_series(
      date_trunc('day', p_start_date AT TIME ZONE 'Asia/Kolkata'),
      date_trunc('day', p_end_date AT TIME ZONE 'Asia/Kolkata'),
      '1 day'::interval
    ) AS day
  ) d
  LEFT JOIN (
    SELECT
      date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata') AS order_day,
      COUNT(*) AS cnt,
      AVG(EXTRACT(EPOCH FROM (ready_at - paid_at))) AS avg_sec
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND paid_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at >= paid_at
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')
  ) agg ON d.day = agg.order_day;

  -- Top 10 slowest orders table
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', o.id,
      'order_number', o.pickup_code,
      'outlet_name', ot.name,
      'ordered_at', to_char(o.created_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH12:MI AM'),
      'total_minutes', ROUND(EXTRACT(EPOCH FROM (o.ready_at - o.paid_at)) / 60.0, 1),
      'total_seconds', EXTRACT(EPOCH FROM (o.ready_at - o.paid_at))::int
    ) ORDER BY (o.ready_at - o.paid_at) DESC
  )
  INTO v_slowest_10
  FROM (
    SELECT *
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND paid_at IS NOT NULL AND ready_at IS NOT NULL AND ready_at >= paid_at
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    ORDER BY (ready_at - paid_at) DESC
    LIMIT 10
  ) o
  LEFT JOIN public.outlets ot ON o.outlet_id = ot.id;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'total_paid_orders', v_total_paid_orders,
      'measured_orders', v_measured_orders,
      'excluded_orders', GREATEST(0, v_total_paid_orders - v_measured_orders),
      'avg_paid_to_ready_sec', ROUND(v_avg_paid_to_ready, 0),
      'avg_paid_to_ready_min', ROUND(v_avg_paid_to_ready / 60.0, 1),
      'pct_within_20', v_pct_within_20,
      'avg_making_sec', ROUND(v_avg_making_sec, 0),
      'avg_packaging_sec', ROUND(v_avg_packaging_sec, 0),
      'slowest_order_id', v_slowest_order.id,
      'slowest_order_code', v_slowest_order.pickup_code,
      'slowest_order_min', v_slowest_order.minutes
    ),
    'daily_trend', COALESCE(v_daily_trend, '[]'::jsonb),
    'slowest_orders', COALESCE(v_slowest_10, '[]'::jsonb)
  );
END;
$$;


-- ==============================================================================
-- 5. TAB 4: BEST ITEMS ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_best_items(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_revenue numeric;
  v_items_list jsonb;
  v_slow_movers jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- Total revenue for share percentage
  SELECT COALESCE(SUM(total), 0) INTO v_total_revenue
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  -- Items sold in range
  WITH item_sales AS (
    SELECT
      COALESCE(item->>'name', 'Unknown Item') AS item_name,
      SUM(COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1))::bigint AS qty_sold,
      SUM(
        COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1) * 
        COALESCE((item->>'unitPrice')::numeric, (item->>'price')::numeric, 0)
      )::numeric AS revenue
    FROM public.orders,
         jsonb_array_elements(orders.items) AS item
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY COALESCE(item->>'name', 'Unknown Item')
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'rank', row_number() OVER (ORDER BY qty_sold DESC, revenue DESC),
      'name', item_name,
      'qty_sold', qty_sold,
      'revenue', revenue,
      'share_pct', CASE WHEN v_total_revenue > 0 THEN ROUND((revenue / v_total_revenue) * 100, 1) ELSE 0 END
    )
  )
  INTO v_items_list
  FROM item_sales;

  -- 5 Slow Movers: lowest-selling active menu items (including 0 sales)
  WITH active_menu AS (
    SELECT id, name
    FROM public.menu_items
    WHERE is_available = true
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
  ),
  sold_counts AS (
    SELECT
      COALESCE(item->>'id', item->>'menu_item_id') AS menu_item_id,
      item->>'name' AS item_name,
      SUM(COALESCE((item->>'quantity')::numeric, (item->>'qty')::numeric, 1))::bigint AS qty_sold
    FROM public.orders,
         jsonb_array_elements(orders.items) AS item
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY COALESCE(item->>'id', item->>'menu_item_id'), item->>'name'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', am.name,
      'qty_sold', COALESCE(sc.qty_sold, 0)
    )
  )
  INTO v_slow_movers
  FROM (
    SELECT am.name, COALESCE(sc.qty_sold, 0) AS qty_sold
    FROM active_menu am
    LEFT JOIN sold_counts sc ON am.name = sc.item_name
    ORDER BY COALESCE(sc.qty_sold, 0) ASC, am.name ASC
    LIMIT 5
  ) am;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items_list, '[]'::jsonb),
    'slow_movers', COALESCE(v_slow_movers, '[]'::jsonb),
    'total_revenue', v_total_revenue
  );
END;
$$;


-- ==============================================================================
-- 6. TAB 5: BOUGHT TOGETHER ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_bought_together(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_paid_orders int;
  v_pairs jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- Total paid orders count to check the 20 order threshold
  SELECT COUNT(*) INTO v_total_paid_orders
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  IF v_total_paid_orders < 20 THEN
    RETURN jsonb_build_object(
      'total_orders', v_total_paid_orders,
      'has_enough_data', false,
      'pairs', '[]'::jsonb
    );
  END IF;

  -- Identify distinct item pairs within orders and count co-occurrences
  WITH order_items_distinct AS (
    SELECT DISTINCT
      o.id AS order_id,
      item->>'name' AS item_name
    FROM public.orders o,
         jsonb_array_elements(o.items) AS item
    WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date
      AND o.status = ANY(v_valid_statuses)
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
      AND item->>'name' IS NOT NULL
  ),
  item_frequencies AS (
    SELECT item_name, COUNT(*) AS total_item_orders
    FROM order_items_distinct
    GROUP BY item_name
  ),
  paired_items AS (
    SELECT
      a.item_name AS item_a,
      b.item_name AS item_b,
      COUNT(*) AS times_together
    FROM order_items_distinct a
    JOIN order_items_distinct b 
      ON a.order_id = b.order_id 
     AND a.item_name < b.item_name
    GROUP BY a.item_name, b.item_name
    HAVING COUNT(*) >= 2
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'item_a', p.item_a,
      'item_b', p.item_b,
      'times_together', p.times_together,
      'pct_of_a', ROUND((p.times_together::numeric / NULLIF(fa.total_item_orders, 0)) * 100, 1)
    ) ORDER BY p.times_together DESC, p.item_a ASC
    LIMIT 15
  )
  INTO v_pairs
  FROM paired_items p
  JOIN item_frequencies fa ON p.item_a = fa.item_name;

  RETURN jsonb_build_object(
    'total_orders', v_total_paid_orders,
    'has_enough_data', true,
    'pairs', COALESCE(v_pairs, '[]'::jsonb)
  );
END;
$$;


-- ==============================================================================
-- 7. TAB 6: REPEAT CUSTOMERS ANALYTICS
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_analytics_repeat_customers(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_outlet_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_paid_orders int;
  v_unique_customers int;
  v_new_customers int;
  v_returning_customers int;
  v_repeat_rate numeric;
  v_top_customers jsonb;
  v_valid_statuses text[] := ARRAY['pending', 'preparing', 'packaging', 'ready', 'received', 'confirmed', 'completed'];
BEGIN
  -- Count total paid orders in range
  SELECT COUNT(*) INTO v_total_paid_orders
  FROM public.orders
  WHERE created_at >= p_start_date AND created_at <= p_end_date
    AND status = ANY(v_valid_statuses)
    AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id);

  IF v_total_paid_orders < 20 THEN
    RETURN jsonb_build_object(
      'total_orders', v_total_paid_orders,
      'has_enough_data', false,
      'kpis', jsonb_build_object(
        'unique_customers', 0,
        'new_customers', 0,
        'returning_customers', 0,
        'repeat_rate_pct', 0
      ),
      'top_customers', '[]'::jsonb
    );
  END IF;

  -- Customers who ordered within the range
  WITH range_customers AS (
    SELECT
      RIGHT(REGEXP_REPLACE(customer_phone, '\D', '', 'g'), 10) AS phone,
      MAX(customer_name) AS customer_name,
      COUNT(*) AS range_orders,
      SUM(total) AS total_spent,
      MAX(created_at) AS last_order_at,
      MIN(created_at) AS first_range_order_at
    FROM public.orders
    WHERE created_at >= p_start_date AND created_at <= p_end_date
      AND status = ANY(v_valid_statuses)
      AND customer_phone IS NOT NULL AND customer_phone != ''
      AND (p_outlet_id IS NULL OR outlet_id = p_outlet_id)
    GROUP BY RIGHT(REGEXP_REPLACE(customer_phone, '\D', '', 'g'), 10)
  ),
  customer_history AS (
    SELECT
      rc.phone,
      rc.customer_name,
      rc.range_orders,
      rc.total_spent,
      rc.last_order_at,
      rc.first_range_order_at,
      EXISTS (
        SELECT 1 FROM public.orders o
        WHERE RIGHT(REGEXP_REPLACE(o.customer_phone, '\D', '', 'g'), 10) = rc.phone
          AND o.created_at < p_start_date
          AND o.status = ANY(v_valid_statuses)
      ) AS had_prior_order
    FROM range_customers rc
  ),
  customer_classification AS (
    SELECT
      phone,
      customer_name,
      range_orders,
      total_spent,
      last_order_at,
      first_range_order_at,
      CASE 
        WHEN had_prior_order OR range_orders >= 2 THEN true 
        ELSE false 
      END AS is_returning,
      CASE 
        WHEN NOT had_prior_order AND range_orders = 1 THEN true 
        ELSE false 
      END AS is_new
    FROM customer_history
  )
  SELECT
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE is_new)::int,
    COUNT(*) FILTER (WHERE is_returning)::int,
    ROUND((COUNT(*) FILTER (WHERE is_returning)::numeric / NULLIF(COUNT(*), 0)) * 100, 1)
  INTO
    v_unique_customers,
    v_new_customers,
    v_returning_customers,
    v_repeat_rate
  FROM customer_classification;

  -- Top 20 Customers Table
  WITH top_cust AS (
    SELECT
      RIGHT(REGEXP_REPLACE(o.customer_phone, '\D', '', 'g'), 10) AS phone,
      MAX(o.customer_name) AS customer_name,
      COUNT(*) AS orders_count,
      SUM(o.total) AS total_spent,
      MAX(o.created_at) AS last_order_at,
      MIN(o.created_at) AS first_order_at
    FROM public.orders o
    WHERE o.created_at >= p_start_date AND o.created_at <= p_end_date
      AND o.status = ANY(v_valid_statuses)
      AND o.customer_phone IS NOT NULL AND o.customer_phone != ''
      AND (p_outlet_id IS NULL OR o.outlet_id = p_outlet_id)
    GROUP BY RIGHT(REGEXP_REPLACE(o.customer_phone, '\D', '', 'g'), 10)
    ORDER BY COUNT(*) DESC, SUM(o.total) DESC
    LIMIT 20
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'phone', tc.phone,
      'name', COALESCE(tc.customer_name, 'Guest Customer'),
      'orders', tc.orders_count,
      'total_spent', tc.total_spent,
      'last_order_date', to_char(tc.last_order_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY'),
      'avg_days_between', CASE 
        WHEN tc.orders_count > 1 THEN 
          ROUND(EXTRACT(EPOCH FROM (tc.last_order_at - tc.first_order_at)) / (86400.0 * (tc.orders_count - 1)), 1)
        ELSE NULL 
      END
    )
  )
  INTO v_top_customers
  FROM top_cust tc;

  RETURN jsonb_build_object(
    'total_orders', v_total_paid_orders,
    'has_enough_data', true,
    'kpis', jsonb_build_object(
      'unique_customers', v_unique_customers,
      'new_customers', v_new_customers,
      'returning_customers', v_returning_customers,
      'repeat_rate_pct', COALESCE(v_repeat_rate, 0)
    ),
    'top_customers', COALESCE(v_top_customers, '[]'::jsonb)
  );
END;
$$;
