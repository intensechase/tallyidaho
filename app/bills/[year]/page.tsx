import { redirect } from 'next/navigation'

interface Props {
  params: Promise<{ year: string }>
}

export default async function BillsYearPage({ params }: Props) {
  const { year } = await params
  redirect(`/bills?year=${year}`)
}
