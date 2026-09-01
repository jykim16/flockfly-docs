export class SerializedCheckpointSaver {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    public revision: number,
    private readonly persist: (baseRevision: number, checkpoint: unknown) => Promise<{ revision: number }>,
  ) {}

  save(checkpoint: unknown): Promise<number> {
    const operation = this.tail.then(async () => {
      const result = await this.persist(this.revision, checkpoint);
      this.revision = result.revision;
      return result.revision;
    });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
