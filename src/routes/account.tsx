import { createFileRoute, Link } from "@tanstack/react-router";

import { MainNavigation, PageHeader } from "#/components/app-shell";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
	return (
		<>
			<main className="app-page account-page">
				<PageHeader title="帳戶" />

				<section className="balance-card" aria-label="資產摘要">
					<div>
						<small>總資產估值</small>
						<div className="balance-amount">NT$ 842,360</div>
					</div>
					<div className="balance-metrics">
						<div className="balance-metric">
							<small>今日損益</small>
							<strong className="gain">+3,840</strong>
							<small className="gain">+0.46%</small>
						</div>
						<div className="balance-metric">
							<small>本月損益</small>
							<strong className="loss">-8,120</strong>
							<small className="loss">-0.95%</small>
						</div>
					</div>
				</section>

				<section className="account-section" aria-label="資產配置">
					<div className="section-heading">
						<h2>配置</h2>
						<Link to="/holdings">檢視明細</Link>
					</div>
					<Link
						className="allocation-card"
						to="/holdings"
						aria-label="檢視資產配置明細"
					>
						<span className="allocation-donut" aria-hidden="true" />
						<span className="allocation-legend">
							<span className="allocation-row">
								<i className="dot green" />
								<span>
									<strong>2330</strong>
									<small>台積電</small>
								</span>
								<b>33%</b>
							</span>
							<span className="allocation-row">
								<i className="dot accent" />
								<span>
									<strong>0050</strong>
									<small>元大台灣50</small>
								</span>
								<b>24%</b>
							</span>
							<span className="allocation-row">
								<i className="dot gold" />
								<span>
									<strong>2412</strong>
									<small>中華電</small>
								</span>
								<b>18%</b>
							</span>
							<span className="allocation-row">
								<i className="dot pale" />
								<span>
									<strong>其他</strong>
									<small>其餘持股與待投入現金</small>
								</span>
								<b>25%</b>
							</span>
						</span>
					</Link>
				</section>

				<section className="account-section" aria-label="提醒">
					<div className="section-heading">
						<h2>提醒</h2>
						<button type="button">新增</button>
					</div>
					<div className="reminder-list">
						<article className="reminder-card">
							<span>
								<strong>台積電接近 1,050</strong>
								<small>到價時推播一次</small>
							</span>
							<b>價格</b>
						</article>
						<article className="reminder-card">
							<span>
								<strong>0050 每月扣款日</strong>
								<small>下次：7 月 8 日</small>
							</span>
							<b>定期</b>
						</article>
					</div>
				</section>
			</main>
			<MainNavigation active="account" />
		</>
	);
}
