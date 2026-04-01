// In its own file to avoid circular dependencies
export const FILE_EDIT_TOOL_NAME = 'Edit'

// Permission pattern for granting session-level access to the project's .Forge/ folder
export const CLAUDE_FOLDER_PERMISSION_PATTERN = '/.Forge/**'

// Permission pattern for granting session-level access to the global ~/.Forge/ folder
export const GLOBAL_CLAUDE_FOLDER_PERMISSION_PATTERN = '~/.Forge/**'

export const FILE_UNEXPECTEDLY_MODIFIED_ERROR =
  'File has been unexpectedly modified. Read it again before attempting to write it.'
