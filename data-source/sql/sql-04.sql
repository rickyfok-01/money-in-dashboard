-- QUERY ID         : SQL-04
-- QUERY NAME       : DDA aging report
-- OUTPUT FILE NAME : dda-aging-{YYYYMMDD}.csv
select /*+ MONITOR PARALLEL(p1 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  p1.scheme_code,
  m1.short_code,
  count(1) total,
  sum(case when trunc(sysdate) - p1.dda_request_date between 0 and 6 then 1 else 0 end) day_00_06,
  sum(case when trunc(sysdate) - p1.dda_request_date between 7 and 14 then 1 else 0 end) day_07_14,
  sum(case when trunc(sysdate) - p1.dda_request_date between 15 and 21 then 1 else 0 end) day_15_21,
  sum(case when trunc(sysdate) - p1.dda_request_date between 22 and 30 then 1 else 0 end) day_22_30,
  sum(case when trunc(sysdate) - p1.dda_request_date >= 31 then 1 else 0 end) day_31_more
from pym_entity_pay_method  p1
join enr_payroll_group      e1 on p1.scheme_code = e1.scheme_code and e1.id = p1.entity_uuid
join cmn_scheme             n1 on p1.scheme_code = n1.scheme_code
join cmn_mem_acct_type      m1 on m1.id = e1.mem_acct_type_uuid
join cmn_trustee            n2 on n2.id = n1.tr_uuid
where
    p1.pay_method_code = 'DIRECT_DEBIT'
and p1.dda_request_date is not null
and p1.av_status_code = 'SUBMITTED_TO_BANK'
group by
  to_char(sysdate,'YYYYMMDD'),
  n2.tr_code,
  p1.scheme_code,
  m1.short_code
;
