/**
 * Validate registration input
 */
export function validateRegistration(username: string, email: string, password: string): string[] {
  const errors: string[] = [];

  if (!username || username.length < 3) {
    errors.push("username must be at least 3 characters");
  }

  if (!email || !isValidEmail(email)) {
    errors.push("invalid email address");
  }

  if (!password || password.length < 6) {
    errors.push("password must be at least 6 characters");
  }

  return errors;
}

/**
 * Validate login input
 */
export function validateLogin(email: string, password: string): string[] {
  const errors: string[] = [];

  if (!email || !isValidEmail(email)) {
    errors.push("invalid email address");
  }

  if (!password) {
    errors.push("password is required");
  }

  return errors;
}

/**
 * Validate market creation
 */
export function validateMarketCreation(
  title: string,
  description: string,
  outcomes: string[],
): string[] {
  const errors: string[] = [];

  if (!title || title.length < 5) {
    errors.push("market title must be at least 5 characters");
  }

  if (outcomes.length < 2) {
    errors.push("market must have at least 2 outcomes");
  }

  if (outcomes.some((o) => !o || o.length === 0)) {
    errors.push("all outcomes must have a title");
  }

  return errors;
}

/**
 * Validate bet placement
 */
export function validateBet(amount: number | string): string[] {
  const errors: string[] = [];
  const numAmount = Number(amount);

  if (isNaN(numAmount) || numAmount <= 0) {
    errors.push("bet amount must be a positive number");
  }

  return errors;
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
