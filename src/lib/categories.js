const EXPENSE = {
  Food: '🍔',
  Travel: '🚕',
  Education: '📚',
  Shopping: '🛍️',
  Bills: '🧾',
  Health: '💊',
  Personal: '🙂',
  Other: '📦',
}
const INCOME = {
  Freelance: '💻',
  Salary: '💼',
  Business: '🏪',
  Other: '💰',
}

export const emojiFor = (type, category) => (type === 'expense' ? EXPENSE : INCOME)[category] ?? '📦'
