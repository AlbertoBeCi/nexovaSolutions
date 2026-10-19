import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { CandidateSelect, STAGE_OPTIONS, STATUS_OPTIONS } from "./candidate-select";

test("el filtro tiene nombre accesible aunque su etiqueta no sea visible", () => {
  render(<CandidateSelect id="status-filter" label="Filtrar por estado" hideLabel options={STATUS_OPTIONS} emptyLabel="Todos los estados" />);
  expect(screen.getByRole("combobox", { name: "Filtrar por estado" })).toHaveValue("");
  expect(screen.getByRole("option", { name: "Todos los estados" })).toHaveValue("");
});

test("presenta etiquetas españolas manteniendo los códigos como valores", () => {
  render(<CandidateSelect id="stage" label="Etapa" options={STAGE_OPTIONS} />);
  for (const [value, label] of STAGE_OPTIONS) {
    expect(screen.getByRole("option", { name: label })).toHaveValue(value);
  }
});

test("la selección controlada conserva el contrato de eventos nativos", () => {
  function ControlledFilter() {
    const [value, setValue] = useState("");
    return <CandidateSelect id="controlled" label="Estado" options={STATUS_OPTIONS} emptyLabel="Todos" value={value} onChange={event => setValue(event.target.value)} />;
  }
  render(<ControlledFilter />);
  const select = screen.getByRole("combobox", { name: "Estado" });
  fireEvent.change(select, { target: { value: STATUS_OPTIONS[1][0] } });
  expect(select).toHaveValue(STATUS_OPTIONS[1][0]);
  fireEvent.change(select, { target: { value: "" } });
  expect(select).toHaveValue("");
});

test("conserva el estado deshabilitado y los atributos del formulario", () => {
  render(<CandidateSelect id="saving" label="Estado" options={STATUS_OPTIONS} disabled required name="status" />);
  const select = screen.getByRole("combobox", { name: "Estado" });
  expect(select).toBeDisabled();
  expect(select).toBeRequired();
  expect(select).toHaveAttribute("name", "status");
});

test("la etiqueta dinámica de guardado sigue asociada al selector", () => {
  render(<CandidateSelect id="saving-stage" label={<>Etapa <span>(guardando...)</span></>} options={STAGE_OPTIONS} disabled />);
  expect(screen.getByLabelText("Etapa (guardando...)")).toHaveAttribute("id", "saving-stage");
});
