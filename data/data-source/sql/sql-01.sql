-- QUERY ID         : SQL-01
-- QUERY NAME       : DDI count sent to PIG 30 days report
-- OUTPUT FILE NAME : ddi-30day-{YYYYMMDD}.csv
select /*+ MONITOR PARALLEL(c1 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  c1.scheme_code,
  m1.short_code,
  trunc(c1.pig_request_date) as ddi_request_date,
  count(m1.short_code) as count,
  sum(case when av_ddi_status_code = 'SUBMITTED_TO_BANK' then 1 else 0 end) submitted_to_bank,
  sum(case when av_ddi_status_code = 'ACTIVE'            then 1 else 0 end) success,
  sum(case when av_ddi_status_code = 'REJECTED'          then 1 else 0 end) rejected
from
       con_pay_method c1
  join con_bill_group_dtl  c2 on c1.scheme_code = c2.scheme_code and c1.id = c2.pay_method_uuid
  join con_bill_group      c3 on c1.scheme_code = c3.scheme_code and c3.id = c2.bill_group_uuid
  join con_submit_group    c4 on c1.scheme_code = c4.scheme_code and c4.submit_ref_no = c3.submit_ref_no
  join con_period_billable c5 on c1.scheme_code = c5.scheme_code and c5.id = c4.period_billable_uuid
  join enr_payroll_group   e1 on c1.scheme_code = e1.scheme_code and e1.id = c5.payroll_group_uuid
  join cmn_mem_acct_type   m1 on m1.id = e1.mem_acct_type_uuid
  join cmn_scheme          n1 on c1.scheme_code = n1.scheme_code
  join cmn_trustee         n2 on n2.id = n1.tr_uuid
where
    c1.pay_method_code = 'DIRECT_DEBIT'
and c1.pig_request_date between trunc(sysdate -31) and trunc(sysdate -1)
group by
  n2.tr_code,
  c1.scheme_code,
  m1.short_code,
  c1.pig_request_date
;
