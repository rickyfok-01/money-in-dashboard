-- QUERY ID         : SQL-07
-- QUERY NAME       : Contribution Payment Pending AO Aging Report
-- OUTPUT FILE NAME : con-pym-ao-aging-{YYYYMMDD}.csv
select  /*+ MONITOR PARALLEL(p1 4) */
  to_char(sysdate,'YYYYMMDD') as snapshot_date,
  n2.tr_code,
  n1.scheme_code,
  p1.av_pay_channel_code,
  p1.av_tag_status_code,
  p1.pay_method_code,
  count(1) total,
  sum(case when trunc(sysdate) - trunc(p1.creation_date) between 0 and 6 then 1 else 0 end) day_00_06,
  sum(case when trunc(sysdate) - trunc(p1.creation_date) between 7 and 14 then 1 else 0 end) day_07_14,
  sum(case when trunc(sysdate) - trunc(p1.creation_date) between 15 and 21 then 1 else 0 end) day_15_21,
  sum(case when trunc(sysdate) - trunc(p1.creation_date) between 22 and 30 then 1 else 0 end) day_22_30,
  sum(case when trunc(sysdate) - trunc(p1.creation_date) >= 31 then 1 else 0 end) day_31_more
from    pym_payment   p1
join    cmn_scheme    n1 on n1.id   = p1.scheme_info
join    cmn_trustee   n2 on n2.id   = n1.tr_uuid
where
    av_tag_status_code in('ONHOLD_UNIDEN_MPF_AC','ONHOLD_3RD_PARTY','ONHOLD_ELIG_PAY','ONHOLD_AML','CLEARED')
and p1.tran_nature = 'CONTRIBUTION'
group by
  to_char(sysdate,'YYYYMMDD'),
  n2.tr_code,
  n1.scheme_code,
  p1.av_pay_channel_code,
  p1.av_tag_status_code,
  p1.pay_method_code
;
