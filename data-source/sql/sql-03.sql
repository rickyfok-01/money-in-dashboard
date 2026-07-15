-- QUERY ID         : SQL-03
-- QUERY NAME       : DDA count sent to PIG 30 days report
-- OUTPUT FILE NAME : dda-30day-{YYYYMMDD}.csv
select /*+ MONITOR PARALLEL(p1 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  p1.scheme_code,
  m1.short_code,
  count(1) total,
  sum(case when p1.av_status_code = 'READY_TO_BANK'     then 1 else 0 end) submitted_to_pig,
  sum(case when p1.av_status_code = 'SUBMITTED_TO_BANK' then 1 else 0 end) submitted_to_bank,
  sum(case when p1.av_status_code = 'ACTIVE'            then 1 else 0 end) active,
  sum(case when p1.av_status_code = 'INACTIVE'          then 1 else 0 end) inactive,
  sum(case when p1.av_status_code = 'REJECTED'          then 1 else 0 end) rejected,
  sum(case when p1.av_status_code = 'SUSPEND'           then 1 else 0 end) suspend
from pym_entity_pay_method  p1
join enr_payroll_group      e1 on p1.scheme_code = e1.scheme_code and e1.id = p1.entity_uuid
join cmn_scheme             n1 on p1.scheme_code = n1.scheme_code
join cmn_mem_acct_type      m1 on m1.id = e1.mem_acct_type_uuid
join cmn_trustee            n2 on n2.id = n1.tr_uuid
where
    p1.pay_method_code = 'DIRECT_DEBIT'
and p1.dda_request_date between trunc(sysdate -31) and trunc(sysdate -1)
group by
  to_char(sysdate,'YYYYMMDD'),
  n2.tr_code,
  p1.scheme_code,
  m1.short_code
;
