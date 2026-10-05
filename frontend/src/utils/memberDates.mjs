export function addCalendarMonth(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new Error('请选择有效日期。')
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const original = new Date(year, month - 1, day, 12)
  if (original.getFullYear() !== year || original.getMonth() !== month - 1 || original.getDate() !== day) throw new Error('请选择有效日期。')
  const lastDay = new Date(year, month + 1, 0, 12).getDate()
  const result = new Date(year, month, Math.min(day, lastDay), 12)
  return `${result.getFullYear()}-${String(result.getMonth()+1).padStart(2,'0')}-${String(result.getDate()).padStart(2,'0')}`
}
export function monthRenewalBase(member, today) {
  return member?.type === '月卡' && member.expiry > today ? member.expiry : today
}
