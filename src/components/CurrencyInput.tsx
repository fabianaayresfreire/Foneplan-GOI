import { Input } from "@/components/ui/input";
import { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number;
  onChange: (value: number) => void;
};

const formatBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export function CurrencyInput({ value, onChange, ...rest }: Props) {
  const cents = Math.round((value || 0) * 100);
  return (
    <Input
      {...rest}
      inputMode="numeric"
      value={formatBRL(cents)}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "");
        const newCents = digits === "" ? 0 : parseInt(digits, 10);
        onChange(newCents / 100);
      }}
    />
  );
}
