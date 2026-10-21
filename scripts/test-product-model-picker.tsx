import assert from "node:assert/strict";
import React, { act, useState } from "react";
import { JSDOM } from "jsdom";
import type { Product } from "../src/types";
import { productionProducts } from "./productionFixtures";

const dom = new JSDOM('<!doctype html><div id="root"></div>', {
  url: "http://localhost/",
});
for (const key of [
  "window",
  "document",
  "HTMLElement",
  "HTMLInputElement",
  "HTMLSelectElement",
  "Event",
  "MouseEvent",
])
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
  });
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import("react-dom/client");
const { ProductModelPicker } = await import(
  "../src/components/ProductModelPicker"
);
let selected: Product | null = null;
function Scenario() {
  const [id, setId] = useState("");
  return (
    <>
      <ProductModelPicker
        id="picker"
        products={productionProducts}
        selectedProductId={id}
        onSelectProduct={(p) => {
          selected = p;
          setId(p?.id || "");
        }}
      />
      <button
        id="add"
        onClick={() => {
          selected = null;
          setId("");
        }}
      >
        Adicionar
      </button>
    </>
  );
}
const root = createRoot(document.querySelector("#root")!);
await act(async () => root.render(<Scenario />));
const select = async (id: string, value: string) =>
  act(async () => {
    const input = document.querySelector<HTMLSelectElement>(id)!;
    input.value = value;
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
assert.equal(
  (document.querySelector("#picker-model") as HTMLSelectElement).options.length,
  3,
);
assert((document.querySelector("#picker-aroma") as HTMLSelectElement).disabled);
await select("#picker-model", "mother:mother");
assert.equal(
  selected,
  null,
  "Selecting a family must not silently choose its first aroma",
);
await select("#picker-aroma", "child");
assert.equal(selected?.id, "child");
assert.equal(selected?.actualPrice, 40);
await act(async () =>
  document.querySelector<HTMLButtonElement>("#add")!.click(),
);
assert.equal(
  (document.querySelector("#picker-model") as HTMLSelectElement).value,
  "mother:mother",
);
assert.equal(
  (document.querySelector("#picker-aroma") as HTMLSelectElement).value,
  "",
);
await select("#picker-aroma", "mother");
assert.equal(selected?.id, "mother");
await select("#picker-model", "product:direct");
assert.equal(selected?.id, "direct");
assert.equal(
  document.querySelector("#picker-aroma"),
  null,
  "Individual products do not require an artificial aroma choice",
);
await act(async () =>
  document.querySelector<HTMLButtonElement>("#add")!.click(),
);
assert.equal(
  (document.querySelector("#picker-model") as HTMLSelectElement).value,
  "",
  "After adding an individual product, the next selection is ready to use",
);
await select("#picker-model", "product:direct");
assert.equal(selected?.id, "direct");
await act(async () => root.unmount());
console.log(
  "Seleção compartilhada: modelo único por família, aroma explícito, ID/preço corretos, troca de modelo e inclusão repetida em pedidos passaram.",
);
