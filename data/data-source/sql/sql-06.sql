-- QUERY ID         : SQL-06
-- QUERY NAME       : Contribution Payment Status Report
-- OUTPUT FILE NAME : con-pym-6mon-{YYYYMMDD}.csv
select  /*+ MONITOR PARALLEL(p1 4) */
        to_char(sysdate,'YYYYMMDD') as snapshot_date,
        n2.tr_code,
        n1.scheme_code,
        p1.av_pay_channel_code,
        p1.av_tag_status_code,
        p1.pay_method_code,
        to_char(p1.creation_date, 'YYYY-MM') as month,
        count(1) payment_count,
        sum(p1.pay_amt) pay_amt,
        sum(nvl(susp.avail_amt,0)) avail_amount
from    pym_payment   p1
join    cmn_scheme    n1 on n1.id   = p1.scheme_info
join    cmn_trustee   n2 on n2.id   = n1.tr_uuid
left join (
        select /*+ PARALLEL(m1 4) NO_MERGE */
               m1.receipt_ref_no,
               m1.scheme_code,
               sum(m1.avail_amt) as avail_amt
        from   mfb_susp_acct m1
        where  m1.to_er_acct_uuid  is null
          and  m1.to_mem_acct_uuid is null
          and (m1.from_er_acct_uuid  is not null
            or m1.from_mem_acct_uuid is not null)
        group by m1.receipt_ref_no, m1.scheme_code
) susp
       on susp.receipt_ref_no = p1.receipt_ref_no
      and susp.scheme_code    = n1.scheme_code
where   p1.creation_date >= add_months(trunc(sysdate), -6)
   and  p1.last_updated_by not in ('IS','IC')
   and  p1.creation_date <  trunc(sysdate)
   and  p1.tran_nature = 'CONTRIBUTION'
   and  p1.av_tag_status_code not in
        ('TR_APPROVE','PEND_TR_APPRV','ADM_FOLLOW_UP','OVER_PAID','MANUAL_TAG','TAGGED','REJECTED','PEND_PYMNT','BANK_IN','BOUNCED','PENDING','RETURNED','DESTROYED','CLOSED','TAGGED_CHEQUE','RECEIVED_CHEQUE','VOID')
group by
  to_char(sysdate,'YYYYMMDD'),
  n2.tr_code,
  n1.scheme_code,
  p1.av_pay_channel_code,
  p1.av_tag_status_code,
  p1.pay_method_code,
  to_char(p1.creation_date, 'YYYY-MM')
;
