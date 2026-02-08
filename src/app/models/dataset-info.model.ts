export interface DatasetInfo {
  /** Unique identifier for the dataset (e.g., james-niv1984) */
  id: string;

  /** Bible book represented in the dataset */
  book: string;

  /** Translation/version label */
  version: string;

  /** Public path to the dataset JSON file */
  path: string;

  /** Optional description displayed in the UI */
  description?: string;

  /** Optional defaults pulled into the user file */
  quizIdPrefix?: string;
  quizIdNumber?: string;
  backupDrive?: string;
  databaseName?: string;
}


