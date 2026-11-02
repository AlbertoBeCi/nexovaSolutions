import { render, screen, waitFor } from "@testing-library/react";
import ProductsPage from "../products-page";

let mockParams = new URLSearchParams();
const mockGet = jest.fn();
const mockTrack = jest.fn();
jest.mock("next/navigation", () => ({ usePathname: () => "/backoffice/inventory/products", useSearchParams: () => mockParams, useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../../../../services/inventory-api", () => ({ getInventoryProducts: (...args: unknown[]) => mockGet(...args) }));
jest.mock("../../../../services/telemetry", () => ({ track: (...args: unknown[]) => mockTrack(...args) }));

test("filters report only successful settled results, with no fabricated count on errors", async () => {
  mockParams = new URLSearchParams(); mockTrack.mockClear(); mockGet.mockResolvedValue([]);
  const view = render(<ProductsPage />);
  await screen.findByText("No hay productos para la oficina seleccionada.");
  expect(mockTrack).not.toHaveBeenCalled();
  mockParams = new URLSearchParams("office=Miami"); view.rerender(<ProductsPage />);
  await waitFor(() => expect(mockTrack).toHaveBeenCalledWith("filter_applied", expect.objectContaining({ filter_keys: ["office"], result_count: 0 })));
  mockTrack.mockClear(); mockGet.mockRejectedValue(new Error("No disponible."));
  mockParams = new URLSearchParams("office=Valencia"); view.rerender(<ProductsPage />);
  await screen.findByRole("alert"); expect(mockTrack).not.toHaveBeenCalled();
});
