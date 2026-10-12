export const PRIVATE_PRODUCT_SCOPE = "everyday-finds-private-links";
export class PrivateProductError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
