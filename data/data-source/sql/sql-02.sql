-- QUERY ID         : SQL-02
-- QUERY NAME       : DDI aging report
-- OUTPUT FILE NAME : ddi-aging-{YYYYMMDD}.csv
select /*+ MONITOR PARALLEL(c1 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  c1.scheme_code,
  m1.short_code,
  count(1) total,
  sum(case when trunc(sysdate) - pig_request_date between 0 and 6 then 1 else 0 end) day_00_06,
  sum(case when trunc(sysdate) - pig_request_date between 7 and 14 then 1 else 0 end) day_07_14,
  sum(case when trunc(sysdate) - pig_request_date between 15 and 21 then 1 else 0 end) day_15_21,
  sum(case when trunc(sysdate) - pig_request_date between 22 and 30 then 1 else 0 end) day_22_30,
  sum(case when trunc(sysdate) - pig_request_date >= 31 then 1 else 0 end) day_31_more
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
and c1.av_ddi_status_code = 'SUBMITTED_TO_BANK'
and c1.pig_request_date is not null
group by
  n2.tr_code,
  c1.scheme_code,
  m1.short_code
;
