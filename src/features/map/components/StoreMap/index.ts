import dynamic from "next/dynamic";

const StoreMap = dynamic(
  async () => {
    const mod = await import("./StoreMap");
    return { default: mod.StoreMap };
  },
  { ssr: false },
);

export { StoreMap };
