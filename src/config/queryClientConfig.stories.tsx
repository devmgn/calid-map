import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useQuery } from "@tanstack/react-query";
import { expect, screen, waitFor } from "storybook/test";

function ErrorToastDemo(props: { skipToast?: boolean }) {
  const { skipToast } = props;
  const { refetch } = useQuery({
    queryKey: ["error-toast-demo", skipToast],
    queryFn: () => {
      throw new Error("サーバーエラーが発生しました");
    },
    enabled: false,
    retry: false,
    meta: skipToast === true ? { skipToast: true } : undefined,
  });

  return (
    <button
      type="button"
      onClick={() => {
        void refetch();
      }}
    >
      {skipToast === true ? "エラー発生 (トースト抑制)" : "エラー発生"}
    </button>
  );
}

const meta = {
  component: ErrorToastDemo,
  parameters: {
    layout: "centered",
  },
  argTypes: {
    skipToast: {
      control: { type: "boolean" },
    },
  },
} satisfies Meta<typeof ErrorToastDemo>;

export default meta;
type Story = StoryObj<typeof ErrorToastDemo>;
export const Default: Story = {
  tags: ["!manifest"],
  play: async ({ canvas }) => {
    canvas.getByRole("button").click();
    await waitFor(async () => {
      await expect(
        screen.getByText("サーバーエラーが発生しました"),
      ).toBeVisible();
    });
  },
};

export const SkipToast: Story = {
  args: { skipToast: true },
  play: async ({ canvas }) => {
    canvas.getByRole("button").click();
    await expect(
      canvas.queryByText("サーバーエラーが発生しました"),
    ).not.toBeInTheDocument();
  },
};
