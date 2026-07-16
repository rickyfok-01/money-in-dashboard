-- QUERY ID         : SQL-05
-- QUERY NAME       : Contribution Bill Status Report
-- OUTPUT FILE NAME : con-bill-6mon-{YYYYMMDD}.csv
with billable as (
  select /*+ no_merge */
    c1.id,
    c1.scheme_code,
    c1.contr_due_date,
    n2.tr_code,
    c1.av_status_code,
    c1.av_bill_contr_mode,
    c1.av_freq_type,
    e2.short_code,
    to_char(trunc(c1.contr_period_start_date, 'MM'), 'YYYY-MM') as year_month
  from con_period_billable  c1
  join enr_payroll_group    e1 on c1.scheme_code = e1.scheme_code and e1.id = c1.payroll_group_uuid
  join cmn_mem_acct_type    e2 on e2.id = e1.mem_acct_type_uuid
  join cmn_scheme           n1 on c1.scheme_code = n1.scheme_code
  join cmn_trustee          n2 on n2.id = n1.tr_uuid
  where
      c1.contr_period_start_date >= add_months(trunc(sysdate), -6)
  and c1.contr_period_start_date <= add_months(trunc(sysdate),  0)
  and c1.last_updated_by not in ('00000000000000000000000000000000|CAS_MIG_CORE')
),
per_bill_submit as (
  select /*+ no_merge parallel(c2 4) */
    b.id,
    b.scheme_code,
    count(c2.period_billable_uuid) submit_count,
    sum(case when b.contr_due_date >= c2.submit_date then 1 else 0 end) ontime_submit_count,
    sum(case when c2.con_submit_channel = 'DDE'         then 1 else 0 end) dde_submit_count,
    sum(case when c2.con_submit_channel = 'BATCH'       then 1 else 0 end) batch_submit_count,
    sum(case when c2.con_submit_channel = 'ER_PORTAL'   then 1 else 0 end) portal_submit_count,
    sum(case when c2.con_submit_channel = 'BULK_UPLOAD' then 1 else 0 end) bulkupload_submit_count,
    sum(case when (c2.con_submit_channel not in ('DDE','BATCH','ER_PORTAL','BULK_UPLOAD') or c2.con_submit_channel is null)
              and c2.period_billable_uuid is not null then 1 else 0 end) other_submit_count
  from billable b
  left join con_submit_group c2 on c2.scheme_code = b.scheme_code and c2.period_billable_uuid = b.id
  group by b.id, b.scheme_code
)
select /*+ parallel(b 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  b.tr_code,
  b.scheme_code ,
  b.av_status_code ,
  b.av_bill_contr_mode ,
  b.av_freq_type ,
  b.short_code ,
  b.year_month ,
  count(1) bill_count,
  sum(case when s.ontime_submit_count > 0 then 1 else 0 end) ontime_submit_count,
  sum(case when s.submit_count > 0 then 1 else 0 end) total_submit_count,
  sum(s.dde_submit_count) dde_submit_count,
  sum(s.batch_submit_count) batch_submit_count ,
  sum(s.portal_submit_count) portal_submit_count ,
  sum(s.bulkupload_submit_count) bulkupload_submit_count ,
  sum(s.other_submit_count) other_submit_count
from billable b
join per_bill_submit s on s.id = b.id and s.scheme_code = b.scheme_code
group by
  to_char(sysdate,'YYYYMMDD'),
  b.tr_code,
  b.scheme_code ,
  b.av_status_code ,
  b.av_bill_contr_mode ,
  b.av_freq_type ,
  b.short_code ,
  b.year_month
;
