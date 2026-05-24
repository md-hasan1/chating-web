// Parse common Prisma validation errors into friendly messages
const parsePrismaValidationError = (errorMessage: string) => {
  const missingFieldsRegex = /Argument `(.+?)` is missing\./g;
  let match;
  const missingFields: string[] = [];

  while ((match = missingFieldsRegex.exec(errorMessage)) !== null) {
    missingFields.push(match[1]);
  }

  const invalidValueRegex = /Argument `(.+?)`: Invalid value provided. Expected (.+), provided (.+)\./g;
  const invalidValues: string[] = [];

  while ((match = invalidValueRegex.exec(errorMessage)) !== null) {
    const field = match[1];
    const expectedType = match[2];
    const providedValue = match[3];
    invalidValues.push(`${field}: Expected ${expectedType}, provided ${providedValue}`);
  }

  const missingFieldsMessage = missingFields.length ? `Missing fields: ${missingFields.join(', ')}` : '';
  const invalidValuesMessage = invalidValues.length ? `Invalid values: ${invalidValues.join('; ')}` : '';

  return `${missingFieldsMessage}${missingFieldsMessage && invalidValuesMessage ? '; ' : ''}${invalidValuesMessage}`;
};

export default parsePrismaValidationError;
