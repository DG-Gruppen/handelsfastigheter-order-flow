interface MutationResult {
  data: unknown;
  error: { message: string } | null;
}

export async function confirmKbMutation(mutation: PromiseLike<MutationResult>) {
  const result = await mutation;
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Ändringen kunde inte sparas. Kontrollera din behörighet och försök igen.");
}