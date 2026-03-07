export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="text-gray-500">Dashboard 統計資料將於 Slice 8 實作</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {['委託人數', '被照護者數', '待處理需求單'].map((label) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-6">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-400">—</p>
          </div>
        ))}
      </div>
    </div>
  );
}
