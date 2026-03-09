describe("runtime", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe("isProduction", () => {
    it('NODE_ENVが"production"のとき、trueとなること', async () => {
      vi.stubEnv("NODE_ENV", "production");
      const { isProduction } = await import("./runtime");
      expect(isProduction).toBe(true);
    });

    it('NODE_ENVが"production"以外のとき、falseとなること', async () => {
      vi.stubEnv("NODE_ENV", "development");
      const { isProduction } = await import("./runtime");
      expect(isProduction).toBe(false);
    });

    it("NODE_ENVが未定義のとき、falseとなること", async () => {
      vi.stubEnv("NODE_ENV", "");
      const { isProduction } = await import("./runtime");
      expect(isProduction).toBe(false);
    });
  });
});
