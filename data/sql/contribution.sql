-- =============================================================================
--  Contribution statistics — two dashboard feeds (last 5 months, monthly grain)
--  Source tables : CAS_CORE.CON_PERIOD_BILLABLE, CON_SUBMIT_GROUP,
--                  CMN_SCHEME, CMN_TRUSTEE, ENR_PAYROLL_GROUP, CMN_MEM_ACCT_TYPE
--
--  Notes
--  * Both feeds now use the SAME date window:
--      contr_period_start_date >= add_months(trunc(sysdate), -5)
--      contr_period_start_date <  add_months(trunc(sysdate),  0)
--    (the second query previously used '<=' which silently included today's
--     partial day, so the two feeds disagreed on the current month-to-date.)
--  * Query 2 was rewritten to remove 7 correlated scalar subqueries against
--    CON_SUBMIT_GROUP. The original explain plan (con-statistic-ex-plan.html)
--    showed cost 69,651,328 / cardinality 1,949,739 with seven repeated
--    SORT AGGREGATE -> PARTITION LIST -> TABLE ACCESS steps on CON_SUBMIT_GROUP.
--    They are now computed in a single pre-aggregated pass (CTE submit_agg).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Query 1 : Contribution status roll-up by scheme / trustee / month
-- FIX: av_bill_type was in SELECT but missing from GROUP BY (ORA-00979).
-- -----------------------------------------------------------------------------
select
  to_char(sysdate,'YYYYMMDD')                                                          as snapshot_date,
  c1.scheme_code,
  n2.tr_code,
  c1.av_bill_type,
  to_char(trunc(c1.contr_period_start_date, 'MM'), 'YYYY-MM')                          as year_month,
  count(*)                                                                             as record_count,
  sum(case when c1.av_status_code in ('PARTIAL_SUBMIT','SUBMITTED','APPROVED','PARTIAL_PAID','FULLY_PAID') then 1 else 0 end) as er_submitted_contr_data_count,
  sum(case when c1.av_status_code in ('PARTIAL_SUBMIT','SUBMITTED','APPROVED') then 1 else 0 end) as pending_tagging_count,
  sum(case when c1.av_status_code = 'OPEN'           then 1 else 0 end) as open_count,
  sum(case when c1.av_status_code = 'PARTIAL_SUBMIT' then 1 else 0 end) as partial_submit_count,
  sum(case when c1.av_status_code = 'SUBMITTED'      then 1 else 0 end) as submitted_count,
  sum(case when c1.av_status_code = 'APPROVED'       then 1 else 0 end) as approved_count,
  sum(case when c1.av_status_code = 'PARTIAL_PAID'   then 1 else 0 end) as partial_paid_count,
  sum(case when c1.av_status_code = 'FULLY_PAID'     then 1 else 0 end) as fully_paid_count,
  sum(case when c1.av_status_code = 'OVERPAID'       then 1 else 0 end) as overpaid_count,
  sum(case when c1.av_status_code = 'REFUND_OVERPAID' then 1 else 0 end) as refund_overpaid_count,
  sum(case when c1.av_status_code = 'WAIVED'         then 1 else 0 end) as waived_count,
  sum(case when c1.av_status_code = 'CLOSED'         then 1 else 0 end) as closed_count
from con_period_billable  c1
join cmn_scheme           n1 on c1.scheme_code = n1.scheme_code
join cmn_trustee          n2 on n2.id = n1.tr_uuid
where
    c1.contr_period_start_date >= add_months(trunc(sysdate), -5)
and c1.contr_period_start_date <  add_months(trunc(sysdate),  0)
group by
  c1.scheme_code,
  n2.tr_code,
  c1.av_bill_type,
  to_char(trunc(c1.contr_period_start_date, 'MM'), 'YYYY-MM')
order by
  c1.scheme_code,
  c1.av_bill_type,
  year_month;


-- -----------------------------------------------------------------------------
-- Query 2 : Submit-channel roll-up by trustee / scheme / bill attributes / month
--
-- The 7 correlated subqueries against CON_SUBMIT_GROUP are replaced by ONE
-- pre-aggregated pass (submit_agg), joined 1:1 to the billable grain via a
-- LEFT JOIN. Output columns and semantics are unchanged.
-- -----------------------------------------------------------------------------
with

-- Pre-aggregate CON_SUBMIT_GROUP once per billable, restricted to the same
-- 5-month window. The join to CON_PERIOD_BILLABLE here is a PK/FK lookup on
-- c1.id purely to obtain contr_due_date for the on-time flag.
submit_agg as (
  select
    c2.scheme_code,
    c2.period_billable_uuid,
    count(*)                                                                                       as submit_count,
    sum(case when c1.contr_due_date >= c2.submit_date then 1 else 0 end)                          as ontime_submit_count,
    sum(case when c2.con_submit_channel = 'DDE'         then 1 else 0 end)                        as dde_submit_count,
    sum(case when c2.con_submit_channel = 'BATCH'       then 1 else 0 end)                        as batch_submit_count,
    sum(case when c2.con_submit_channel = 'ER_PORTAL'   then 1 else 0 end)                        as portal_submit_count,
    sum(case when c2.con_submit_channel = 'BULK_UPLOAD' then 1 else 0 end)                        as bulkupload_submit_count,
    sum(case when c2.con_submit_channel not in ('DDE','BATCH','ER_PORTAL','BULK_UPLOAD')
              or c2.con_submit_channel is null then 1 else 0 end)                                  as other_submit_count
  from con_submit_group    c2
  join con_period_billable c1
    on c1.id = c2.period_billable_uuid
   and c1.scheme_code = c2.scheme_code
  where
      c1.contr_period_start_date >= add_months(trunc(sysdate), -5)
  and c1.contr_period_start_date <  add_months(trunc(sysdate),  0)
  group by
    c2.scheme_code,
    c2.period_billable_uuid
)

select
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  c1.scheme_code,
  c1.av_status_code,
  c1.av_bill_contr_mode,
  c1.av_freq_type,
  e2.short_code,
  to_char(trunc(c1.contr_period_start_date, 'MM'), 'YYYY-MM') as year_month,
  count(1)                                                                         as bill_count,
  sum(case when sa.ontime_submit_count > 0 then 1 else 0 end)                      as ontime_submit_count,
  sum(case when sa.submit_count       > 0 then 1 else 0 end)                       as total_submit_count,
  nvl(sum(sa.dde_submit_count),0)                                                  as dde_submit_count,
  nvl(sum(sa.batch_submit_count),0)                                                as batch_submit_count,
  nvl(sum(sa.portal_submit_count),0)                                               as portal_submit_count,
  nvl(sum(sa.bulkupload_submit_count),0)                                           as bulkupload_submit_count,
  nvl(sum(sa.other_submit_count),0)                                                as other_submit_count
from con_period_billable  c1
join enr_payroll_group    e1 on c1.scheme_code = e1.scheme_code and e1.id = c1.payroll_group_uuid
join cmn_mem_acct_type    e2 on e2.id = e1.mem_acct_type_uuid
join cmn_scheme           n1 on c1.scheme_code = n1.scheme_code
join cmn_trustee          n2 on n2.id = n1.tr_uuid
left join submit_agg      sa on sa.period_billable_uuid = c1.id and sa.scheme_code = c1.scheme_code
where
    c1.contr_period_start_date >= add_months(trunc(sysdate), -5)
and c1.contr_period_start_date <  add_months(trunc(sysdate),  0)
group by
  n2.tr_code,
  c1.scheme_code,
  c1.av_status_code,
  c1.av_bill_contr_mode,
  c1.av_freq_type,
  e2.short_code,
  to_char(trunc(c1.contr_period_start_date, 'MM'), 'YYYY-MM')
order by
  n2.tr_code,
  c1.scheme_code,
  year_month;
