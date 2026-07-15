/* ########################################################################################################################
                                                    DIRECT DEBIT SECTION
######################################################################################################################## */

-- QUERY ID         : SQL-01
-- QUERY NAME       : DDI count sent to PIG 30 days report
-- OUTPUT FILE NAME : ddi-30day-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 cost ~1,258,368, dominated by a FULL scan of CON_PAY_METHOD (PARTITION LIST ALL).
--                    (1) added PARALLEL(c1 4) to parallelise the driving full scan (only lever available without a
--                        supporting index; matches the PARALLEL style already used in SQL-06/07);
--                    (2) removed the redundant predicate "(pig_request_date is not null or reraise_date =
--                        pig_request_date)" -- it is logically implied by the BETWEEN range that follows, so the
--                        result set is unchanged.
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

-- QUERY ID         : SQL-02
-- QUERY NAME       : DDI aging report
-- OUTPUT FILE NAME : ddi-aging-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 cost driven by the FULL scan of CON_PAY_METHOD; added PARALLEL(c1 4) to parallelise it.
--                    Predicates already minimal (aging report covers all SUBMITTED_TO_BANK DDIs).
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

-- QUERY ID         : SQL-03
-- QUERY NAME       : DDA count sent to PIG 30 days report
-- OUTPUT FILE NAME : dda-30day-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 cost ~15,736, driven by the FULL scan of PYM_ENTITY_PAY_METHOD.
--                    (1) added PARALLEL(p1 4) to parallelise the driving full scan;
--                    (2) removed the redundant "dda_request_date is not null" -- it is implied by the BETWEEN range.
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

-- QUERY ID         : SQL-04
-- QUERY NAME       : DDA aging report
-- OUTPUT FILE NAME : dda-aging-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 cost ~16,803, driven by the FULL scan of PYM_ENTITY_PAY_METHOD; added PARALLEL(p1 4).
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

/* ########################################################################################################################
                                                    CONTRIBUTION SECTION
######################################################################################################################## */

-- QUERY ID         : SQL-05
-- QUERY NAME       : Contribution Bill Status Report
-- OUTPUT FILE NAME : con-bill-6mon-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 cost ~69,651,328 -- by far the worst plan. Root cause: SEVEN correlated scalar subqueries
--                    against CON_SUBMIT_GROUP, each re-probing the CON_SUBMIT_GROUP_FK1 index once per billable row.
--                    Replaced all seven subqueries with a SINGLE aggregation (per_bill_submit) computed by joining
--                    CON_SUBMIT_GROUP to the billable set once and grouping per billable. The outer aggregation is
--                    preserved exactly:
--                      * submit_count / ontime_submit_count  -> sum(case when cnt > 0 ...)  (billables-with-any)
--                      * dde/batch/portal/bulk/other         -> sum(cnt)                    (totals)
--                    Dropped the unused projections (bill_ref_no, payroll_group_uuid) and added PARALLEL on the two
--                    large base tables (con_period_billable, con_submit_group).
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
      c1.contr_period_start_date >= add_months(trunc(sysdate), -5)
  and c1.contr_period_start_date <= add_months(trunc(sysdate),  0)
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

-- QUERY ID         : SQL-06
-- QUERY NAME       : Contribution Payment Status Report
-- OUTPUT FILE NAME : con-pym-6mon-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 plan already well structured (PX parallel, NO_MERGE susp agg with Bloom JOIN FILTER
--                    pruning, partition pruning on pym_payment). Kept as-is -- no logic change, nothing redundant.
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
where   p1.creation_date >= add_months(trunc(sysdate), -5)
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

-- QUERY ID         : SQL-07
-- QUERY NAME       : Contribution Payment Pending AO Aging Report
-- OUTPUT FILE NAME : con-pym-ao-aging-{YYYYMMDD}.csv
-- OPTIMIZATION     : V1 plan already efficient -- drives off PYM_PAYMENT_I1 with an INLIST ITERATOR on the 5 status
--                    codes (cost ~21,428). Kept as-is; nothing redundant.
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
