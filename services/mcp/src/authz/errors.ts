export class AuthzError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
