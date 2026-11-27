// Unit tests never touch the database or real secrets: give them a throwaway signing key.
process.env.AUTH_SECRET = "unit-test-secret-unit-test-secret-0123456789";
