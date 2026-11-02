import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AdminLayout from '../../components/AdminLayout';

const money = (value) => `₦${(Number(value) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const titles = { overview: 'Overview', users: 'Users', deposits: 'Deposits', withdrawals: 'Withdrawals', gateway: 'Gateway', packages: 'Packages', 'gift-codes': 'Gift codes', settings: 'Site settings' };
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Status({ value }) {
  const tone = ['approved', 'paid', 'active', 'recorded', 'completed'].includes(String(value).toLowerCase()) ? 'good' : ['failed', 'rejected', 'banned', 'unknown'].includes(String(value).toLowerCase()) ? 'bad' : 'pending';
  return <span className={`admin-status ${tone}`}>{String(value || 'unknown').replaceAll('_', ' ')}</span>;
}

function Empty({ text = 'Nothing to show yet.' }) { return <div className="admin-empty">{text}</div>; }

function TableWrap({ children }) { return <div className="admin-table-wrap"><table className="admin-table">{children}</table></div>; }

export default function AdminDashboard() {
  const router = useRouter();
  const tab = String(router.query.tab || 'overview');
  const selectedUserId = String(router.query.userId || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [page, setPage] = useState(0);
  const [searchText, setSearchText] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [withdrawalPassword, setWithdrawalPassword] = useState('');
  const [settings, setSettings] = useState(null);
  const [packageForm, setPackageForm] = useState(null);
  const [giftForm, setGiftForm] = useState(null);
  const [gatewayTopup, setGatewayTopup] = useState({ amount: '', externalReference: '', note: '' });
  const [gatewayPayout, setGatewayPayout] = useState({ amount: '', name: '', account: '', bankCode: '', reason: '' });

  async function loadData() {
    setLoading(true); setError('');
    try {
      let section = tab === 'overview' ? 'stats' : tab === 'gift-codes' ? 'gift-codes' : tab;
      let query = new URLSearchParams({ section });
      if (tab === 'users' && selectedUserId) query = new URLSearchParams({ section: 'user', id: selectedUserId });
      else if (tab === 'users') {
        query.set('page', String(page)); query.set('limit', '25');
        if (appliedSearch) query.set('search', appliedSearch);
        if (statusFilter) query.set('status', statusFilter);
      } else if (['deposits', 'withdrawals', 'gift-codes'].includes(tab)) {
        query.set('page', String(page)); query.set('limit', '50');
        if (statusFilter) query.set('status', statusFilter);
      }
      const response = await fetch(`/api/admin?${query.toString()}`, { credentials: 'same-origin', cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Could not load this admin section.');
      setData(payload);
      if (tab === 'settings') setSettings(payload);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData(); /* load only when the selected section/filter changes */ }, [tab, selectedUserId, page, appliedSearch, statusFilter, refreshKey]);

  async function postAction(payload, successText) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Administrator action failed.');
      setNotice(successText || result.message || 'Saved successfully.');
      setRefreshKey((value) => value + 1);
      return result;
    } catch (err) { setError(err.message); return null; }
    finally { setBusy(false); }
  }

  function openUser(userId) { router.push({ pathname: '/admin', query: { tab: 'users', userId } }, undefined, { shallow: true, scroll: false }); }
  function closeUser() { router.push({ pathname: '/admin', query: { tab: 'users' } }, undefined, { shallow: true, scroll: false }); }
  function changeFilter(value) { setPage(0); setStatusFilter(value); }

  const body = useMemo(() => {
    if (loading && !data) return <div className="admin-loading-inline"><span className="admin-loader" />Loading {titles[tab] || 'admin'}…</div>;
    if (tab === 'overview') return <Overview data={data || {}} />;
    if (tab === 'users') return selectedUserId
      ? <UserDetails data={data} busy={busy} onBack={closeUser} onBan={(user) => postAction({ action: 'set-user-ban', userId: user.id, banned: !user.is_banned, reason: user.is_banned ? '' : 'Administrator action' }, user.is_banned ? 'Account unbanned.' : 'Account banned.')} onAdjust={(user, adjustment) => postAction({ action: 'adjust-user-wallet', userId: user.id, ...adjustment }, 'Wallet adjustment applied.')} />
      : <UsersPanel data={data} searchText={searchText} setSearchText={setSearchText} onSearch={(event) => { event.preventDefault(); setPage(0); setAppliedSearch(searchText.trim()); }} statusFilter={statusFilter} onFilter={changeFilter} onOpenUser={openUser} page={page} total={data?.total || 0} limit={data?.limit || 25} onPage={setPage} />;
    if (tab === 'deposits') return <DepositsPanel rows={data?.rows || []} busy={busy} onReview={(row, decision) => postAction({ action: 'deposit-review', id: row.id, decision }, `Deposit ${decision}d.`)} statusFilter={statusFilter} onFilter={changeFilter} page={page} total={data?.total || 0} limit={data?.limit || 50} onPage={setPage} />;
    if (tab === 'withdrawals') return <WithdrawalsPanel rows={data?.rows || []} busy={busy} password={withdrawalPassword} setPassword={setWithdrawalPassword} onReview={(row, decision) => postAction({ action: 'withdrawal-review', id: row.id, decision, withdrawalPassword }, decision === 'approve' ? 'Withdrawal sent to AfrStar for processing.' : 'Withdrawal rejected and refund requested.').then((result) => result && setWithdrawalPassword(''))} statusFilter={statusFilter} onFilter={changeFilter} page={page} total={data?.total || 0} limit={data?.limit || 50} onPage={setPage} />;
    if (tab === 'gateway') return <GatewayPanel data={data || {}} payoutPassword={withdrawalPassword} setPayoutPassword={setWithdrawalPassword} payout={gatewayPayout} setPayout={setGatewayPayout} topup={gatewayTopup} setTopup={setGatewayTopup} busy={busy} onTopup={(event) => { event.preventDefault(); postAction({ action: 'record-gateway-topup', ...gatewayTopup }, 'Top-up reconciliation entry recorded.').then((result) => result && setGatewayTopup({ amount: '', externalReference: '', note: '' })); }} onPayout={(event) => { event.preventDefault(); postAction({ action: 'gateway-withdrawal', ...gatewayPayout, withdrawalPassword }, 'Payout sent to AfrStar.').then((result) => result && (setGatewayPayout({ amount: '', name: '', account: '', bankCode: '', reason: '' }), setWithdrawalPassword(''))); }} onRefresh={() => setRefreshKey((value) => value + 1)} />;
    if (tab === 'packages') return <PackagesPanel rows={data?.rows || []} form={packageForm} setForm={setPackageForm} busy={busy} onSave={(event) => { event.preventDefault(); postAction({ action: 'save-package', package: packageForm, id: packageForm.id }, 'Package saved.').then((result) => result && setPackageForm(null)); }} onDelete={(row) => { if (window.confirm(`Archive “${row.name}”? Existing customer records will be preserved.`)) postAction({ action: 'delete-package', id: row.id }, 'Package archived.'); }} />;
    if (tab === 'gift-codes') return <GiftCodesPanel rows={data?.rows || []} form={giftForm} setForm={setGiftForm} busy={busy} onSave={(event) => { event.preventDefault(); postAction({ action: 'save-gift-code', giftCode: giftForm, id: giftForm.id }, 'Gift code saved.').then((result) => result && setGiftForm(null)); }} onDelete={(row) => { if (window.confirm(`Deactivate gift code ${row.code}?`)) postAction({ action: 'delete-gift-code', id: row.id }, 'Gift code deactivated.'); }} statusFilter={statusFilter} onFilter={changeFilter} page={page} total={data?.total || 0} limit={data?.limit || 50} onPage={setPage} />;
    if (tab === 'settings') return <SettingsPanel settings={settings || data || {}} setSettings={setSettings} busy={busy} onSave={(event) => { event.preventDefault(); postAction({ action: 'save-settings', settings }, 'Site settings updated and now active.'); }} />;
    return <Empty text="Section not found." />;
  }, [tab, data, loading, selectedUserId, busy, searchText, appliedSearch, statusFilter, withdrawalPassword, packageForm, giftForm, gatewayPayout, gatewayTopup, settings, refreshKey]);

  return <AdminLayout title={titles[tab] || 'Admin'}>
    {(error || notice) && <div className={`admin-alert ${error ? 'error' : 'success'}`} role="status"><span>{error || notice}</span><button type="button" onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss">×</button></div>}
    {loading && data && <div className="admin-refresh-line">Refreshing data…</div>}
    {body}
  </AdminLayout>;
}

function Overview({ data }) {
  const cards = [
    ['Total users', data.totalUsers, 'People registered'],
    ['Pending deposits', data.pendingDeposits, 'Awaiting status'],
    ['Pending withdrawals', data.pendingWithdrawals, 'Require review'],
    ['Active packages', data.activePackages, 'Customer plans'],
    ["Today's deposits", money(data.todayDeposits), 'Approved today'],
    ['Total deposit requests', data.totalDeposits, 'All statuses']
  ];
  return <>
    <section className="admin-stat-grid">{cards.map(([label, value, sub]) => <article className="admin-stat-card" key={label}><span>{label}</span><strong>{value ?? '—'}</strong><small>{sub}</small></article>)}</section>
    <section className="admin-card admin-overview-note"><div><span className="admin-eyebrow">OPERATIONS</span><h2>Admin dashboard is connected</h2><p>Use the sections above to manage customer accounts, payment review, payout approvals, products, gift codes, and customer-facing policies.</p></div><div className="admin-overview-links"><a href="/admin?tab=deposits">Review deposits</a><a href="/admin?tab=withdrawals">Review withdrawals</a><a href="/admin?tab=settings">Update site rules</a></div></section>
  </>;
}

function UsersPanel({ data, searchText, setSearchText, onSearch, statusFilter, onFilter, onOpenUser, page, total, limit, onPage }) {
  const users = data?.users || [];
  return <section className="admin-card">
    <div className="admin-section-head"><div><h2>Member directory</h2><p>Search accounts, inspect wallet activity and teams, and apply account bans.</p></div><span className="admin-count">{data?.total || 0} users</span></div>
    <form className="admin-filter-row" onSubmit={onSearch}><input aria-label="Search users" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search name, phone, email, or referral code" /><button className="admin-button primary">Search</button><select aria-label="User status" value={statusFilter} onChange={(event) => onFilter(event.target.value)}><option value="">All accounts</option><option value="active">Active</option><option value="banned">Banned</option></select></form>
    {!users.length ? <Empty text="No matching users found." /> : <TableWrap><thead><tr><th>Member</th><th>Phone</th><th>Joined</th><th>Status</th><th>Admin</th><th /></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><b>{user.full_name || 'Member'}</b><small className="admin-subline">ID {String(user.id).slice(0, 10)} · Code {user.referral_code || '—'}</small></td><td>{user.phone || '—'}</td><td>{dateTime(user.created_at)}</td><td><Status value={user.is_banned ? 'banned' : 'active'} /></td><td>{user.is_admin ? 'Admin' : '—'}</td><td><button className="admin-button subtle" onClick={() => onOpenUser(user.id)}>View account</button></td></tr>)}</tbody></TableWrap>}
    <Pagination page={page} total={total} limit={limit} onPage={onPage} />
  </section>;
}

function UserDetails({ data, busy, onBack, onBan, onAdjust }) {
  const [adjustment, setAdjustment] = useState({ bucket: 'balance', amount: '', reason: '' });
  if (!data?.user) return <Empty text="Choose a user from the directory." />;
  const user = data.user;
  const wallet = data.wallet || {};
  return <div className="admin-user-detail">
    <button className="admin-back-link" onClick={onBack}>‹ Back to users</button>
    <section className="admin-card admin-member-card"><div className="admin-member-header"><div className="admin-avatar">{String(user.full_name || 'M').slice(0, 1).toUpperCase()}</div><div className="admin-member-title"><h2>{user.full_name || 'Member'}</h2><p>ID {user.id} · {user.phone || 'No phone'} · Code {user.referral_code || '—'}</p><small>{user.email || 'No email'} · Joined {dateTime(user.created_at)}</small></div><Status value={user.is_banned ? 'banned' : 'active'} /></div>
      <div className="admin-balance-grid"><div><span>Recharge balance</span><strong>{money(wallet.balance)}</strong></div><div><span>Income balance</span><strong className="gold-text">{money(wallet.income_balance)}</strong></div><div><span>Pending withdrawal</span><strong>{money(wallet.pending_out)}</strong></div></div>
      <div className="admin-member-actions"><button className={`admin-button ${user.is_banned ? 'primary' : 'danger'}`} disabled={busy || user.is_admin} onClick={() => { if (!user.is_banned && !window.confirm('Ban this account? The member will lose access immediately.')) return; onBan(user); }}>{user.is_banned ? 'Unban account' : 'Ban account'}</button><span>{user.is_admin ? 'Administrator account' : 'Access changes take effect on the next API request.'}</span></div>
      <form className="admin-adjust-form" onSubmit={(event) => { event.preventDefault(); onAdjust(user, adjustment).then((result) => result && setAdjustment({ bucket: adjustment.bucket, amount: '', reason: '' })); }}>
        <h3>Adjust balance</h3><div className="admin-adjust-fields"><label><span>Wallet</span><select value={adjustment.bucket} onChange={(event) => setAdjustment({ ...adjustment, bucket: event.target.value })}><option value="balance">Recharge balance</option><option value="income_balance">Income balance</option></select></label><label><span>Amount (+/- NGN)</span><input type="number" step="0.01" value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} placeholder="e.g. 5000 or -200" required /></label><label><span>Reason</span><input value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} placeholder="Verification / correction reason" maxLength="240" required /></label><button className="admin-button primary" disabled={busy}>Apply adjustment</button></div><small>Every adjustment is atomic and added to the user’s transaction history and admin audit log.</small>
      </form>
    </section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Team</h2><p>Direct and second-level referrals.</p></div></div><div className="admin-team-columns"><TeamList title={`Level 1 · ${data.team?.level1?.length || 0}`} rows={data.team?.level1 || []} /><TeamList title={`Level 2 · ${data.team?.level2?.length || 0}`} rows={data.team?.level2 || []} /></div></section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Saved bank accounts</h2><p>Account numbers are masked in the dashboard.</p></div></div>{data.banks?.length ? <TableWrap><thead><tr><th>Bank</th><th>Name</th><th>Account</th><th>Default</th></tr></thead><tbody>{data.banks.map((bank) => <tr key={bank.id}><td>{bank.bank_name || bank.bank_code || '—'}</td><td>{bank.account_name || '—'}</td><td>{bank.account_number_masked || '—'}</td><td>{bank.is_default ? 'Yes' : 'No'}</td></tr>)}</tbody></TableWrap> : <Empty text="No bank accounts saved." />}</section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Deposits</h2><p>Recent deposit requests for this user.</p></div></div>{data.deposits?.length ? <TableWrap><thead><tr><th>Amount</th><th>Reference</th><th>Status</th><th>Created</th></tr></thead><tbody>{data.deposits.map((row) => <tr key={row.id}><td>{money(row.amount)}</td><td>{row.provider_ref || '—'}</td><td><Status value={row.status} /></td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></TableWrap> : <Empty text="No deposit records." />}</section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Withdrawals</h2><p>Beneficiary account details are masked.</p></div></div>{data.withdrawals?.length ? <TableWrap><thead><tr><th>Requested</th><th>Net payout</th><th>Fee</th><th>Destination</th><th>Status</th><th>Date</th></tr></thead><tbody>{data.withdrawals.map((row) => <tr key={row.id}><td>{money(row.amount)}</td><td>{money(row.payout_amount ?? row.amount)}</td><td>{money(row.fee_amount)}</td><td>{row.account_name || '—'} · {row.account_number_masked || '••••'}</td><td><Status value={row.status} /></td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></TableWrap> : <Empty text="No withdrawal records." />}</section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Wallet transactions</h2><p>Latest 100 account transactions.</p></div></div>{data.transactions?.length ? <TableWrap><thead><tr><th>Type</th><th>Direction</th><th>Amount</th><th>Reference</th><th>Date</th></tr></thead><tbody>{data.transactions.map((row) => <tr key={row.id}><td>{row.type || '—'}</td><td>{row.direction || '—'}</td><td>{money(row.amount)}</td><td>{row.reference || '—'}</td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></TableWrap> : <Empty text="No wallet transactions." />}</section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Customer packages</h2><p>Purchases and current progress.</p></div></div>{data.packages?.length ? <TableWrap><thead><tr><th>Plan</th><th>Paid</th><th>Progress</th><th>Status</th><th>Purchased</th></tr></thead><tbody>{data.packages.map((row) => <tr key={row.id}><td>{row.packages?.name || row.package_id}</td><td>{money(row.price_paid)}</td><td>{row.days_collected || 0}/{row.days || row.packages?.days || '—'}</td><td><Status value={row.status} /></td><td>{dateTime(row.purchased_at)}</td></tr>)}</tbody></TableWrap> : <Empty text="No package history." />}</section>
  </div>;
}

function TeamList({ title, rows }) {
  return <div className="admin-team-list"><h3>{title}</h3>{rows.length ? rows.map((member) => <div key={member.id}><b>{member.full_name || 'Member'}</b><span>{member.phone || '—'}</span><Status value={member.is_banned ? 'banned' : member.activated_at ? 'active' : 'pending'} /></div>) : <p className="admin-muted">No members at this level.</p>}</div>;
}

function DepositsPanel({ rows, busy, onReview, statusFilter, onFilter, page, total, limit, onPage }) {
  return <section className="admin-card"><div className="admin-section-head"><div><h2>Deposit requests</h2><p>Review requests; approved deposits are credited using the atomic deposit/referral RPC.</p></div><FilterSelect value={statusFilter} onChange={onFilter} /></div>
    {!rows.length ? <Empty text="No deposit requests." /> : <TableWrap><thead><tr><th>Member</th><th>Amount</th><th>Reference</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.users?.full_name || 'Member'}</b><small className="admin-subline">{row.users?.phone || row.user_id}</small></td><td>{money(row.amount)}</td><td>{row.provider_ref || '—'}</td><td><Status value={row.status} /></td><td>{dateTime(row.created_at)}</td><td>{['initiated', 'pending', 'processing'].includes(row.status) ? <div className="admin-row-actions"><button disabled={busy} className="admin-button primary" onClick={() => onReview(row, 'approve')}>Approve</button><button disabled={busy} className="admin-button danger" onClick={() => window.confirm('Reject this deposit?') && onReview(row, 'reject')}>Reject</button></div> : '—'}</td></tr>)}</tbody></TableWrap>}
    <Pagination page={page} total={total} limit={limit} onPage={onPage} />
  </section>;
}

function WithdrawalsPanel({ rows, busy, password, setPassword, onReview, statusFilter, onFilter, page, total, limit, onPage }) {
  const needsPassword = rows.some((row) => row.status === 'pending');
  return <section className="admin-card"><div className="admin-section-head"><div><h2>Withdrawal queue</h2><p>Manual approvals dispatch to AfrStar only after the separate payout password is verified.</p></div><FilterSelect value={statusFilter} onChange={onFilter} /></div>
    {needsPassword && <div className="admin-payout-password"><label>Separate gateway withdrawal password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter payout password to approve" /></label><small>Never stored in this browser or database. Server-side password verification is required for every payout.</small></div>}
    {!rows.length ? <Empty text="No withdrawal requests." /> : <TableWrap><thead><tr><th>Member</th><th>Requested</th><th>Fee</th><th>Net payout</th><th>Bank destination</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.users?.full_name || 'Member'}</b><small className="admin-subline">{row.users?.phone || row.user_id}</small></td><td>{money(row.amount)}</td><td>{money(row.fee_amount)}</td><td>{money(row.payout_amount ?? row.amount)}</td><td>{row.account_name || '—'}<small className="admin-subline">{row.bank_code || ''} · {row.account_number_masked || '••••'}</small></td><td><Status value={row.status} /></td><td>{dateTime(row.created_at)}</td><td>{row.status === 'pending' ? <div className="admin-row-actions"><button disabled={busy || !password} className="admin-button primary" onClick={() => onReview(row, 'approve')}>Approve & send</button><button disabled={busy} className="admin-button danger" onClick={() => window.confirm('Reject and refund this withdrawal?') && onReview(row, 'reject')}>Reject</button></div> : '—'}</td></tr>)}</tbody></TableWrap>}
    <Pagination page={page} total={total} limit={limit} onPage={onPage} />
  </section>;
}

function GatewayPanel({ data, payoutPassword, setPayoutPassword, payout, setPayout, topup, setTopup, busy, onTopup, onPayout, onRefresh }) {
  const balance = data.balance;
  return <div className="admin-gateway-grid">
    <section className="admin-card admin-gateway-balance"><div className="admin-section-head"><div><span className="admin-eyebrow">AFRSTAR NIGERIA</span><h2>Gateway balance</h2><p>Live merchant balance query; credentials are kept server-side.</p></div><button className="admin-button subtle" onClick={onRefresh}>Refresh</button></div>{balance?.error ? <div className="admin-alert error">{balance.error}</div> : <><strong className="admin-gateway-number">{money(balance?.balance)}</strong><small>NGN · Updated {dateTime(balance?.fetchedAt)}</small></>}</section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Record an external top-up</h2><p>AfrStar v2 does not document a programmatic top-up endpoint. Complete the deposit in AfrStar, then record its reference here.</p></div></div><form className="admin-form-grid" onSubmit={onTopup}><Field label="Amount (NGN)" type="number" min="0.01" step="0.01" value={topup.amount} onChange={(v) => setTopup({ ...topup, amount: v })} required /><Field label="AfrStar reference" value={topup.externalReference} onChange={(v) => setTopup({ ...topup, externalReference: v })} required /><Field label="Note" value={topup.note} onChange={(v) => setTopup({ ...topup, note: v })} /><button className="admin-button primary" disabled={busy}>Record top-up</button></form></section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Gateway withdrawal</h2><p>Every manual merchant payout requires the separate server-verified password.</p></div></div><form className="admin-form-grid" onSubmit={onPayout}><Field label="Amount (NGN)" type="number" min="0.01" step="0.01" value={payout.amount} onChange={(v) => setPayout({ ...payout, amount: v })} required /><Field label="Beneficiary name" value={payout.name} onChange={(v) => setPayout({ ...payout, name: v })} required /><Field label="Bank account number" inputMode="numeric" value={payout.account} onChange={(v) => setPayout({ ...payout, account: v.replace(/\D/g, '').slice(0, 20) })} required /><Field label="AfrStar bank code" placeholder="e.g. 80000004" value={payout.bankCode} onChange={(v) => setPayout({ ...payout, bankCode: v })} required /><Field label="Reason / narration" value={payout.reason} onChange={(v) => setPayout({ ...payout, reason: v })} /><label className="admin-field"><span>Separate payout password</span><input type="password" autoComplete="new-password" value={payoutPassword} onChange={(event) => setPayoutPassword(event.target.value)} required /></label><div className="admin-security-note">Password is compared on the server against an environment-configured bcrypt hash and rate-limited. If missing or wrong, no payout is sent.</div><button className="admin-button danger" disabled={busy}>Send gateway payout</button></form></section>
    <section className="admin-card admin-full-card"><div className="admin-section-head"><div><h2>Gateway activity</h2><p>Top-up records, payout requests, and callback status.</p></div></div>{data.ledger?.length ? <TableWrap><thead><tr><th>Direction</th><th>Amount</th><th>Reference</th><th>Provider ref</th><th>Status</th><th>Created</th></tr></thead><tbody>{data.ledger.map((row) => <tr key={row.id}><td>{row.direction}</td><td>{money(row.amount)}</td><td>{row.order_sn || '—'}</td><td>{row.platform_osn || '—'}</td><td><Status value={row.status} /></td><td>{dateTime(row.created_at)}</td></tr>)}</tbody></TableWrap> : <Empty text="No gateway ledger entries." />}</section>
  </div>;
}

function PackagesPanel({ rows, form, setForm, busy, onSave, onDelete }) {
  const blank = { name: '', category: 'general', price: '', daily_income: '', total_income: '', days: '', image_url: '', vip_required_invites: 0, is_active: true, is_locked: false };
  const edit = (row) => setForm({ ...row });
  return <div className="admin-two-col"><section className="admin-card"><div className="admin-section-head"><div><h2>{form ? (form.id ? 'Edit package' : 'Add package') : 'Package catalogue'}</h2><p>Archive instead of deleting so existing customer purchase history stays intact.</p></div>{!form && <button className="admin-button primary" onClick={() => setForm({ ...blank })}>Add package</button>}</div>
    {!rows.length ? <Empty text="No packages configured." /> : <TableWrap><thead><tr><th>Package</th><th>Price</th><th>Daily</th><th>Total</th><th>Days</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b>{row.name}</b><small className="admin-subline">{row.category} · {row.vip_required_invites || 0} VIP invites</small></td><td>{money(row.price)}</td><td>{money(row.daily_income)}</td><td>{money(row.total_income)}</td><td>{row.days}</td><td><Status value={row.is_active ? 'active' : 'inactive'} /></td><td><div className="admin-row-actions"><button className="admin-button subtle" onClick={() => edit(row)}>Edit</button><button className="admin-button danger" onClick={() => onDelete(row)}>Archive</button></div></td></tr>)}</tbody></TableWrap>}
  </section>{form && <section className="admin-card"><div className="admin-section-head"><div><h2>{form.id ? 'Edit package' : 'New package'}</h2><p>Package changes are immediately reflected on the customer plans page.</p></div><button className="admin-close" onClick={() => setForm(null)}>×</button></div><form className="admin-form-grid" onSubmit={onSave}><Field label="Package name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /><label className="admin-field"><span>Category</span><select value={form.category || 'general'} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="general">Standard</option><option value="vip">VIP</option></select></label><Field label="Price (NGN)" type="number" min="0.01" step="0.01" value={form.price} onChange={(v) => setForm({ ...form, price: v })} required /><Field label="Daily income (NGN)" type="number" min="0" step="0.01" value={form.daily_income} onChange={(v) => setForm({ ...form, daily_income: v })} required /><Field label="Total income (NGN)" type="number" min="0" step="0.01" value={form.total_income} onChange={(v) => setForm({ ...form, total_income: v })} required /><Field label="Duration (days)" type="number" min="1" step="1" value={form.days} onChange={(v) => setForm({ ...form, days: v })} required /><Field label="Image URL (optional)" value={form.image_url || ''} onChange={(v) => setForm({ ...form, image_url: v })} /><Field label="VIP invite threshold" type="number" min="0" step="1" value={form.vip_required_invites || 0} onChange={(v) => setForm({ ...form, vip_required_invites: v })} /><CheckField label="Active on the customer site" checked={form.is_active !== false} onChange={(v) => setForm({ ...form, is_active: v })} /><CheckField label="Locked / coming soon" checked={Boolean(form.is_locked)} onChange={(v) => setForm({ ...form, is_locked: v })} /><div className="admin-form-actions"><button className="admin-button primary" disabled={busy}>Save package</button><button type="button" className="admin-button subtle" onClick={() => setForm(null)}>Cancel</button></div></form></section>}</div>;
}

function GiftCodesPanel({ rows, form, setForm, busy, onSave, onDelete, statusFilter, onFilter, page, total, limit, onPage }) {
  const blank = { code: '', amount: '', max_uses: '', expires_at: '', is_active: true };
  return <div className="admin-two-col"><section className="admin-card"><div className="admin-section-head"><div><h2>Gift-code inventory</h2><p>Manage reward codes. Deactivation preserves redemption history.</p></div><select className="admin-filter-select" value={statusFilter} onChange={(event) => onFilter(event.target.value)} aria-label="Gift-code status"><option value="">All codes</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>{!rows.length ? <Empty text="No gift codes created." /> : <TableWrap><thead><tr><th>Code</th><th>Value</th><th>Uses</th><th>Expires</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b className="code-text">{row.code}</b></td><td>{money(row.amount || row.value)}</td><td>{row.used_count || 0}{row.max_uses ? ` / ${row.max_uses}` : ' / unlimited'}</td><td>{row.expires_at ? dateTime(row.expires_at) : 'Never'}</td><td><Status value={row.is_active ? 'active' : 'inactive'} /></td><td><div className="admin-row-actions"><button className="admin-button subtle" onClick={() => setForm({ ...row, amount: row.amount || row.value || '' })}>Edit</button><button className="admin-button danger" onClick={() => onDelete(row)}>Deactivate</button></div></td></tr>)}</tbody></TableWrap>}<Pagination page={page} total={total} limit={limit} onPage={onPage} /></section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>{form ? (form.id ? 'Edit gift code' : 'New gift code') : 'Create a gift code'}</h2><p>Leave code blank to generate a random code.</p></div><button className="admin-button primary" onClick={() => setForm(form ? null : { ...blank })}>{form ? 'Close' : 'Create'}</button></div>{form && <form className="admin-form-grid" onSubmit={onSave}><Field label="Code" value={form.code || ''} onChange={(v) => setForm({ ...form, code: v.toUpperCase() })} /><Field label="Wallet reward (NGN)" type="number" min="0.01" step="0.01" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} required /><Field label="Maximum redemptions (blank = unlimited)" type="number" min="1" step="1" value={form.max_uses ?? ''} onChange={(v) => setForm({ ...form, max_uses: v })} /><Field label="Expires at" type="datetime-local" value={form.expires_at ? String(form.expires_at).slice(0, 16) : ''} onChange={(v) => setForm({ ...form, expires_at: v })} /><CheckField label="Code is active" checked={form.is_active !== false} onChange={(v) => setForm({ ...form, is_active: v })} /><div className="admin-form-actions"><button className="admin-button primary" disabled={busy}>Save code</button><button type="button" className="admin-button subtle" onClick={() => setForm(null)}>Cancel</button></div></form>}</section>
  </div>;
}

function SettingsPanel({ settings, setSettings, busy, onSave }) {
  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const days = Array.isArray(settings.wd_days) ? settings.wd_days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  return <form className="admin-settings-form" onSubmit={onSave}>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Deposit limits</h2><p>These are validated by the server before checkout creation.</p></div></div><div className="admin-form-grid"><Field label="Minimum deposit (NGN)" type="number" min="0" step="0.01" value={settings.dep_min_amount ?? 1000} onChange={(v) => update('dep_min_amount', v)} /><Field label="Maximum deposit (NGN; 0 = no maximum)" type="number" min="0" step="0.01" value={settings.dep_max_amount ?? 0} onChange={(v) => update('dep_max_amount', v)} /></div></section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Withdrawal policy</h2><p>Limits, schedule, and charges are enforced by the payout API.</p></div></div><div className="admin-form-grid"><Field label="Minimum withdrawal (NGN)" type="number" min="0" step="0.01" value={settings.wd_min_amount ?? 1000} onChange={(v) => update('wd_min_amount', v)} /><Field label="Maximum withdrawal (NGN)" type="number" min="0" step="0.01" value={settings.wd_max_amount ?? 1000000} onChange={(v) => update('wd_max_amount', v)} /><Field label="Withdrawal charge (%)" type="number" min="0" max="100" step="0.01" value={settings.withdrawal_fee_pct ?? 0} onChange={(v) => update('withdrawal_fee_pct', v)} /><Field label="Fixed withdrawal charge (NGN)" type="number" min="0" step="0.01" value={settings.withdrawal_fee_fixed ?? 0} onChange={(v) => update('withdrawal_fee_fixed', v)} /><label className="admin-field"><span>Payout processing</span><select value={settings.withdrawal_mode || 'automatic'} onChange={(event) => update('withdrawal_mode', event.target.value)}><option value="manual">Admin approval before gateway</option><option value="automatic">Automatically send to gateway</option></select></label><CheckField label="Restrict withdrawals to a schedule" checked={Boolean(settings.wd_schedule_enabled)} onChange={(value) => update('wd_schedule_enabled', value)} /><Field label="Opens (WAT)" type="time" value={settings.wd_hours_start || '00:00'} onChange={(v) => update('wd_hours_start', v)} /><Field label="Closes (WAT)" type="time" value={settings.wd_hours_end || '23:59'} onChange={(v) => update('wd_hours_end', v)} /><div className="admin-field admin-days-field"><span>Allowed days (West Africa Time)</span><div>{dayNames.map((name, index) => <label key={name}><input type="checkbox" checked={days.includes(index)} onChange={(event) => update('wd_days', event.target.checked ? [...days, index].sort() : days.filter((day) => day !== index))} />{name}</label>)}</div></div></div></section>
    <section className="admin-card"><div className="admin-section-head"><div><h2>Rewards and community</h2><p>Welcome and referral bonuses are credited server-side; the WhatsApp invite updates the customer dashboard and support page.</p></div></div><div className="admin-form-grid"><Field label="Welcome bonus (NGN)" type="number" min="0" step="0.01" value={settings.welcome_bonus ?? 0} onChange={(v) => update('welcome_bonus', v)} /><Field label="Level 1 deposit bonus (%)" type="number" min="0" max="100" step="0.01" value={settings.referral_deposit_bonus_l1_pct ?? 0} onChange={(v) => update('referral_deposit_bonus_l1_pct', v)} /><Field label="Level 2 deposit bonus (%)" type="number" min="0" max="100" step="0.01" value={settings.referral_deposit_bonus_l2_pct ?? 0} onChange={(v) => update('referral_deposit_bonus_l2_pct', v)} /><Field label="WhatsApp group invite URL" type="url" value={settings.whatsapp_group_url || ''} onChange={(v) => update('whatsapp_group_url', v)} placeholder="https://chat.whatsapp.com/..." /></div></section>
    <div className="admin-sticky-save"><span>Settings take effect on the next customer request.</span><button className="admin-button primary" disabled={busy}>{busy ? 'Saving…' : 'Save all settings'}</button></div>
  </form>;
}

function Field({ label, value, onChange, type = 'text', min, max, step, required = false, placeholder, inputMode }) {
  return <label className="admin-field"><span>{label}</span><input type={type} min={min} max={max} step={step} value={value ?? ''} onChange={(event) => onChange(event.target.value)} required={required} placeholder={placeholder} inputMode={inputMode} /></label>;
}

function CheckField({ label, checked, onChange }) {
  return <label className="admin-check-field"><input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function FilterSelect({ value, onChange }) {
  return <select className="admin-filter-select" value={value} onChange={(event) => onChange(event.target.value)} aria-label="Filter by status"><option value="">All statuses</option><option value="pending">Pending</option><option value="initiated">Initiated</option><option value="processing">Processing</option><option value="approved">Approved</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="rejected">Rejected</option></select>;
}

function Pagination({ page, total, limit, onPage }) {
  if (total <= limit) return null;
  return <div className="admin-pagination"><span>Page {page + 1} · {total} records</span><div><button className="admin-button subtle" disabled={page <= 0} onClick={() => onPage(Math.max(0, page - 1))}>Previous</button><button className="admin-button subtle" disabled={(page + 1) * limit >= total} onClick={() => onPage(page + 1)}>Next</button></div></div>;
}
