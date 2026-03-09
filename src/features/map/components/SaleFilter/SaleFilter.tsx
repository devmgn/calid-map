"use client";

interface SaleFilterProps {
  saleTypes: string[];
  selectedSales: string[];
  onToggle: (saleType: string) => void;
  totalCount: number;
  filteredCount: number;
}

function SaleFilter({
  saleTypes,
  selectedSales,
  onToggle,
  totalCount,
  filteredCount,
}: SaleFilterProps) {
  if (saleTypes.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-semibold">セール絞り込み</h2>
      <div className="flex flex-col gap-2">
        {saleTypes.map((type) => (
          <label key={type} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedSales.includes(type)}
              onChange={() => {
                onToggle(type);
              }}
              className="rounded"
            />
            {type}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs text-gray-500">
        {filteredCount} / {totalCount} 店舗表示中
      </p>
    </div>
  );
}

export { SaleFilter };
