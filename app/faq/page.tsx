import { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'FAQ — How Idaho Laws Are Made | Tally Idaho',
  description: 'Understand how a bill becomes law in Idaho, what legislative terms mean, and how to read voting records. A plain-language guide to the Idaho Legislature.',
  alternates: { canonical: 'https://www.tallyidaho.com/faq' },
}

export const revalidate = 86400

const PROCESS_STEPS = [
  {
    step: '1',
    title: 'Introduction (First Reading)',
    body: 'A legislator drafts a bill and submits it to their chamber — the Idaho Senate or House of Representatives. The bill is assigned a number (Senate bills: S1001, House bills: H0489) and read by title only on the floor. The presiding officer refers it to the appropriate standing committee.',
    link: { href: '/bills', label: 'Browse introduced bills' },
  },
  {
    step: '2',
    title: 'Committee Hearing',
    body: 'The committee chair schedules a hearing. Legislators, agency officials, lobbyists, and members of the public can testify for or against the bill. The committee may also request a fiscal note — an estimate of the bill\'s cost or savings to the state.',
    link: { href: '/committees', label: 'View standing committees' },
  },
  {
    step: '3',
    title: 'Committee Vote',
    body: 'After hearings, the committee votes on the bill. They can: pass it as-is, pass it with amendments (a "committee substitute"), hold it without a vote (which effectively kills it for the session), or send it to another committee. Bills that die in committee never reach the floor.',
  },
  {
    step: '4',
    title: 'Second & Third Reading (Floor Debate)',
    body: 'Bills that clear committee are placed on the calendar. On second reading, members can propose amendments. On third reading, the full chamber debates and votes. A simple majority (36 of 70 House members, or 18 of 35 Senators) is required to pass.',
    link: { href: '/legislators', label: 'See all Idaho legislators' },
  },
  {
    step: '5',
    title: 'Other Chamber',
    body: 'A bill that passes the Senate goes to the House, and vice versa. It goes through the exact same process — committee referral, hearing, vote, floor debate, and final vote. If the second chamber amends the bill, it must go back to the first chamber for concurrence.',
  },
  {
    step: '6',
    title: 'Conference Committee (if needed)',
    body: 'If the House and Senate pass different versions of the same bill and cannot agree, a conference committee is formed — typically three members from each chamber. They negotiate a compromise version, which both chambers must then vote to approve.',
  },
  {
    step: '7',
    title: 'Enrollment & Governor\'s Desk',
    body: 'Once both chambers pass identical language, the bill is enrolled (a clean final copy is prepared) and sent to the Governor. The Governor has 10 days while the Legislature is in session (5 days if adjourned) to sign it, veto it, or let it become law without a signature.',
  },
  {
    step: '8',
    title: 'Veto Override',
    body: 'If the Governor vetoes a bill, the Legislature can override the veto with a two-thirds majority vote in both chambers — that\'s 47 of 70 House members and 24 of 35 Senators. A successful override makes the bill law without the Governor\'s signature.',
    link: { href: '/bills?controversial=true', label: 'View party-line & close votes' },
  },
  {
    step: '9',
    title: 'Effective Date',
    body: 'Most Idaho laws take effect on July 1 of the year they are passed. Bills with an emergency clause take effect immediately upon signing. The Legislature can also specify a custom effective date.',
    link: { href: '/sessions', label: 'Browse all sessions' },
  },
]

const CALENDAR_ORDERS = [
  {
    name: 'First Reading (New Introductions)',
    senate: 'scal1',
    house: 'hcal1',
    body: 'The very first step. A brand-new bill is introduced, assigned a number, and its title is read aloud. The presiding officer refers it to a committee. No debate happens — this is just the official entry of the bill into the process. On Tally Idaho, these appear in the "Today\'s Bills" tab on the homepage.',
  },
  {
    name: 'Second Reading',
    senate: '10th Order',
    house: 'Second Reading',
    body: 'A bill that has cleared committee is read for the second time on the floor. This signals the bill has survived committee review and is now before the full chamber. Members may propose amendments. A second reading does not mean a final vote has happened — the bill still needs to pass third reading.',
  },
  {
    name: 'Third Reading (Final Floor Vote)',
    senate: '10th Order',
    house: 'Third Reading',
    body: 'The final stage before a bill leaves the chamber. The full membership debates the bill and then votes. This is the roll call vote that appears on Tally Idaho — the recorded yea/nay count for every legislator. A bill that passes third reading in one chamber moves to the other; one that fails is dead.',
  },
  {
    name: 'General Orders',
    senate: '—',
    house: 'General Orders',
    body: 'A House-specific stage where bills are considered for amendment before being sent to third reading. Bills in General Orders can be amended, debated, or sent back to committee. In the Senate, amendment work typically happens during second reading.',
  },
  {
    name: '10th Order (Senate)',
    senate: '10th Order',
    house: '—',
    body: 'The Senate\'s main daily business section — numbered after the Idaho Senate\'s standing rules of procedure. The 10th Order contains the bulk of the day\'s action: resolutions and memorials, gubernatorial appointment confirmations, bills on second reading, and bills on third reading (final passage votes). If a bill is in the 10th Order under Third Reading, it is being voted on today.',
  },
  {
    name: '14th Order (Senate)',
    senate: '14th Order',
    house: '—',
    body: 'An additional Senate business section used for overflow legislation or bills requiring special handling. Like the 10th Order, it can contain second and third reading bills. Numbered per the Senate\'s standing rules. Bills here are just as binding as those in the 10th Order — the order number is procedural, not a ranking of importance.',
  },
  {
    name: 'Resolutions & Memorials (in the Orders)',
    senate: '10th Order',
    house: 'Third Reading',
    body: 'Resolutions (HCR, SCR, SJM, HJM, etc.) appear alongside bills in the daily orders. They go through the same reading process but do not become law — they are formal expressions of legislative opinion, requests to Congress, or internal procedural actions. A concurrent resolution (HCR/SCR) passes both chambers; a memorial (SJM/HJM) is addressed to the federal government.',
  },
  {
    name: 'Gubernatorial Appointments',
    senate: '10th Order',
    house: '—',
    body: 'The Idaho Senate confirms the Governor\'s appointments to state boards and commissions (e.g., Fish & Game Commission, Parks & Recreation Board). These appear in the 10th Order alongside legislation. A confirmed appointee is approved; a rejected one cannot serve. The House does not vote on appointments.',
  },
]

const TERMS = [
  {
    term: 'Adjournment / Sine Die',
    def: '"Sine die" is Latin for "without a day." When the Legislature adjourns sine die, it ends the session with no scheduled date to reconvene. On Tally Idaho, bills from sessions that have adjourned sine die are marked as closed.',
  },
  {
    term: 'Amendment',
    def: 'A proposed change to the text of a bill. Amendments can be offered in committee or on the floor. If an amendment passes, the bill is reprinted with the changes incorporated.',
  },
  {
    term: 'Appropriation',
    def: 'A legislative authorization to spend a specific amount of public money for a specific purpose. The Legislature must appropriate funds before any state agency can spend them.',
  },
  {
    term: 'Bicameral',
    def: 'A legislature with two chambers. Idaho\'s Legislature is bicameral — the Senate (35 members) and the House of Representatives (70 members).',
  },
  {
    term: 'Bill',
    def: 'A proposed law. A bill only becomes law after passing both chambers and being signed by the Governor (or the veto being overridden). Until then it is a "bill," not a law.',
    link: { href: '/bills', label: 'Browse Idaho bills' },
  },
  {
    term: 'Caucus',
    def: 'A meeting of members of the same political party within a chamber. Caucuses are where parties coordinate strategy, elect leaders, and discuss upcoming votes.',
  },
  {
    term: 'Chaptered',
    def: 'After the Governor signs a bill, it is assigned a chapter number in the Idaho Session Law and eventually codified into the Idaho Code. "Chaptered" means it is now permanent law.',
  },
  {
    term: 'Concurrent Resolution',
    def: 'A measure that must pass both chambers but does not require the Governor\'s signature and does not have the force of law. Often used for procedural matters or expressions of legislative opinion.',
  },
  {
    term: 'Conference Committee',
    def: 'A temporary joint committee formed when the House and Senate pass different versions of a bill. Members from both chambers negotiate a compromise. Both chambers must then approve the final version.',
  },
  {
    term: 'Do Pass / Do Pass as Amended',
    def: 'A committee\'s recommendation that the full chamber approve a bill. "Do Pass" means approve as-is; "Do Pass as Amended" means approve with the committee\'s changes.',
  },
  {
    term: 'Emergency Clause',
    def: 'Language in a bill that makes it take effect immediately upon the Governor\'s signature rather than waiting for the standard July 1 effective date. Requires a two-thirds vote to include.',
  },
  {
    term: 'Engrossed Bill',
    def: 'A bill that has been updated to incorporate all amendments adopted during floor debate. The engrossed version is the official text sent to the other chamber.',
  },
  {
    term: 'Enrolled Bill',
    def: 'The final, clean version of a bill after it has passed both chambers in identical form, before it is sent to the Governor. The enrolled bill is what the Governor actually signs.',
  },
  {
    term: 'Fiscal Note',
    def: 'A written estimate of the financial impact of a proposed bill — how much it would cost or save the state. Prepared by the Division of Financial Management. Bills with significant costs may face more scrutiny.',
  },
  {
    term: 'Floor',
    def: 'The main chamber where all members of the Senate or House meet to debate and vote. "On the floor" means a bill is being considered by the full membership, as opposed to in committee.',
  },
  {
    term: 'Held in Committee',
    def: 'When a committee takes no action on a bill, allowing it to die at the end of the session. One of the most common ways bills fail — they are quietly held rather than formally killed.',
  },
  {
    term: 'Idaho Code',
    def: 'The permanent, codified collection of all Idaho statutes. When a bill becomes law, its provisions are inserted into the appropriate title and chapter of the Idaho Code.',
  },
  {
    term: 'Interim Committee',
    def: 'A committee that meets between regular legislative sessions to study specific issues and prepare recommendations or draft legislation for the next session.',
  },
  {
    term: 'Joint Memorial',
    def: 'A formal statement from the Idaho Legislature addressed to the U.S. Congress or another government body, expressing the Legislature\'s position on a federal issue. Passes both chambers but carries no binding legal force.',
  },
  {
    term: 'Lobbyist',
    def: 'A person paid to advocate for or against legislation on behalf of an organization, company, or interest group. Lobbyists must register with the state. They frequently testify in committee hearings.',
  },
  {
    term: 'Majority Leader',
    def: 'The floor leader of the majority party in a chamber, responsible for scheduling legislation and managing the party\'s legislative agenda.',
  },
  {
    term: 'Memorial',
    def: 'A document expressing the Legislature\'s opinion or request to Congress, the President, or a federal agency. Has no force of law.',
  },
  {
    term: 'Minority Leader',
    def: 'The floor leader of the minority party in a chamber. Coordinates the minority party\'s response to legislation and represents the minority in procedural matters.',
  },
  {
    term: 'Party-Line Vote',
    def: 'A vote where members of each party vote as a bloc — Republicans on one side, Democrats on the other. Tally Idaho flags bills where the final vote broke sharply along party lines.',
    link: { href: '/bills?controversial=true', label: 'View controversial votes' },
  },
  {
    term: 'Pocket Veto',
    def: 'Not applicable in Idaho. The Idaho Constitution requires the Governor to take action on a bill — sign it, veto it, or let it become law without signature — within a fixed time period.',
  },
  {
    term: 'President Pro Tempore',
    def: 'The presiding officer of the Idaho Senate, elected by Senate members. The Lieutenant Governor is the constitutionally designated President of the Senate but the Pro Tem handles day-to-day presiding duties.',
  },
  {
    term: 'Pro Tempore (Pro Tem)',
    def: 'Latin for "for the time being." Used to designate a temporary presiding officer — e.g., the Senate President Pro Tempore presides in the Lieutenant Governor\'s absence.',
  },
  {
    term: 'Quorum',
    def: 'The minimum number of members required to conduct official business. In Idaho, a majority of each chamber constitutes a quorum — 36 of 70 House members, or 18 of 35 Senators.',
  },
  {
    term: 'Recess',
    def: 'A temporary break in legislative proceedings, within a session. Different from adjournment, which ends a day\'s work, and sine die, which ends the session entirely.',
  },
  {
    term: 'Resolution',
    def: 'A measure expressing the opinion or will of the Legislature, or directing an internal action. Unlike a bill, a resolution does not become law.',
  },
  {
    term: 'Roll Call Vote',
    def: 'A vote in which each member\'s individual position (yea, nay, or absent) is recorded. All votes on Tally Idaho are roll call votes — you can see exactly how every legislator voted.',
    link: { href: '/bills', label: 'See all roll call votes' },
  },
  {
    term: 'Session',
    def: 'The period during which the Legislature is officially in business. Idaho holds a regular session beginning in January each year. The Governor can also call special sessions for specific purposes.',
    link: { href: '/sessions', label: 'Browse all sessions' },
  },
  {
    term: 'Speaker of the House',
    def: 'The presiding officer of the Idaho House of Representatives, elected by House members. The Speaker controls the floor schedule and committee appointments.',
  },
  {
    term: 'Special Session',
    def: 'An extraordinary legislative session called by the Governor outside the regular annual session, limited to the specific subjects the Governor designates.',
  },
  {
    term: 'Sponsor',
    def: 'The legislator who introduces a bill and champions its passage. A bill can have one primary sponsor and multiple co-sponsors. Committees can also sponsor bills.',
    link: { href: '/legislators', label: 'Find your legislators' },
  },
  {
    term: 'Standing Committee',
    def: 'A permanent committee that meets each session to review bills in a specific subject area — e.g., Health & Welfare, Education, Judiciary & Rules. Most bills live or die in committee.',
    link: { href: '/committees', label: 'View standing committees' },
  },
  {
    term: 'Statute',
    def: 'A law enacted by the Legislature and signed by the Governor. All Idaho statutes are compiled in the Idaho Code.',
  },
  {
    term: 'Supermajority',
    def: 'A vote threshold higher than a simple majority (more than half). Idaho uses supermajorities in specific situations: (1) Veto override — 2/3 of both chambers (47 House, 24 Senate). (2) Emergency clause — 2/3 vote to make a bill take effect immediately. (3) Article V Convention — resolutions calling for a U.S. Constitutional Convention require a 2/3 vote. (4) Constitutional amendments — require a 2/3 vote in both chambers before going to voters. When a supermajority is required, a bill can have more Yea votes than Nay votes and still fail — because it didn\'t reach the higher threshold. For example, a 36–34 House vote fails an Article V resolution because 36 is only 51%, far short of the 47 votes (67%) required.',
  },
  {
    term: 'Substitute Bill',
    def: 'A completely rewritten version of a bill that replaces the original. Committee substitutes are common when a committee wants to substantially change a bill\'s approach.',
  },
  {
    term: 'Table (a motion)',
    def: 'To postpone or set aside a motion or bill indefinitely. Tabling a bill is often equivalent to killing it for the session.',
  },
  {
    term: 'Veto',
    def: 'The Governor\'s rejection of a bill passed by the Legislature. A vetoed bill is returned to the Legislature with the Governor\'s objections. The Legislature can override a veto with a two-thirds majority in both chambers.',
  },
  {
    term: 'Voice Vote',
    def: 'A vote in which members call out "aye" or "nay" and the presiding officer judges which side is louder. Individual votes are not recorded. Tally Idaho only shows roll call votes, where individual positions are on the record.',
  },
]

export default function FAQPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      ...PROCESS_STEPS.map(s => ({
        '@type': 'Question',
        name: `What is ${s.title} in the Idaho Legislature?`,
        acceptedAnswer: { '@type': 'Answer', text: s.body },
      })),
      ...TERMS.slice(0, 15).map(t => ({
        '@type': 'Question',
        name: `What is "${t.term}" in Idaho Legislature terms?`,
        acceptedAnswer: { '@type': 'Answer', text: t.def },
      })),
    ],
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-400 mb-6">
        <Link href="/" className="hover:text-amber-600">Home</Link>
        <span className="mx-2">›</span>
        <span className="text-slate-600">FAQ</span>
      </nav>

      <h1 className="page-heading mb-2">
        How Idaho Laws Are Made
      </h1>
      <p className="text-slate-500 text-sm mb-10 leading-relaxed">
        A plain-language guide to the Idaho legislative process, key terms, and how to read what you see on Tally Idaho.
      </p>

      {/* Process */}
      <section className="mb-14">
        <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-6">THE PROCESS — HOW A BILL BECOMES LAW</h2>
        <div className="space-y-4">
          {PROCESS_STEPS.map(s => (
            <div key={s.step} className="flex gap-4 bg-white border border-slate-200 rounded-xl p-5">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#0f172a] text-amber-400 text-sm font-black flex items-center justify-center">
                {s.step}
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">{s.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{s.body}</p>
                {(s as any).link && (
                  <Link href={(s as any).link.href} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline mt-2 font-medium">
                    {(s as any).link.label} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick fact bar */}
        <div className="mt-6 bg-[#1e293b] rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          {[
            { label: 'Senate seats', value: '35' },
            { label: 'House seats', value: '70' },
            { label: 'Districts', value: '35' },
            { label: 'To override veto', value: '⅔ vote' },
          ].map(f => (
            <div key={f.label}>
              <p className="text-2xl font-black text-amber-400">{f.value}</p>
              <p className="text-xs text-slate-400 uppercase tracking-widest mt-0.5">{f.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Floor Calendar Orders */}
      <section className="mb-14">
        <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-2">THE DAILY FLOOR CALENDAR — READING ORDERS</h2>
        <p className="text-sm text-slate-500 mb-6">
          Each day the Legislature is in session, the Senate and House publish a floor calendar listing which bills will be considered. Bills are grouped by "reading" — the stage they are at in the process.
        </p>
        <div className="space-y-3">
          {CALENDAR_ORDERS.map(o => (
            <details key={o.name} className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-start justify-between px-5 py-3.5 cursor-pointer list-none hover:bg-slate-50 transition-colors gap-3">
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-slate-800 text-sm">{o.name}</span>
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {o.senate !== '—' && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
                        Senate: {o.senate}
                      </span>
                    )}
                    {o.house !== '—' && (
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        House: {o.house}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-slate-300 group-open:rotate-90 transition-transform text-lg leading-none shrink-0 mt-0.5">›</span>
              </summary>
              <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed">{o.body}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Glossary */}
      <section>
        <h2 className="text-xs font-bold tracking-widest text-slate-400 mb-6">GLOSSARY OF TERMS</h2>
        <div className="space-y-2">
          {TERMS.map(t => (
            <details key={t.term} className="group bg-white border border-slate-200 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer list-none hover:bg-slate-50 transition-colors">
                <span className="font-semibold text-slate-800 text-sm">{t.term}</span>
                <span className="text-slate-300 group-open:rotate-90 transition-transform text-lg leading-none">›</span>
              </summary>
              <div className="px-5 pb-4 pt-1 border-t border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed">{t.def}</p>
                {(t as any).link && (
                  <Link href={(t as any).link.href} className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline mt-2 font-medium">
                    {(t as any).link.label} →
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <div className="mt-12 bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-slate-800 mb-1">Ready to dig in?</p>
        <p className="text-sm text-slate-500 mb-4">Browse Idaho bills, track your legislators, and see how every vote was cast.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/bills" className="bg-[#0f172a] text-amber-400 text-sm font-bold px-5 py-2 rounded-lg hover:bg-slate-800 transition-colors">
            Browse Bills
          </Link>
          <Link href="/legislators" className="border border-slate-300 text-slate-700 text-sm font-semibold px-5 py-2 rounded-lg hover:border-amber-400 transition-colors">
            Find Your Legislators
          </Link>
        </div>
      </div>

    </main>
  )
}
