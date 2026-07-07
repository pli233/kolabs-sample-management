import { test as base, createBdd } from 'playwright-bdd'

// Single shared `test` so every step file binds to the same fixtures.
export const test = base
export const { Given, When, Then } = createBdd(test)
