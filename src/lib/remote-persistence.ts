export class SerializedSnapshotSaver {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    public revision: number,
    private readonly persist: (baseRevision: number, snapshot: unknown) => Promise<{ revision: number }>,
  ) {}

  save(snapshot: unknown): Promise<number> {
    const operation = this.tail.then(async () => {
      const result = await this.persist(this.revision, snapshot);
      this.revision = result.revision;
      return result.revision;
    });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }
}
