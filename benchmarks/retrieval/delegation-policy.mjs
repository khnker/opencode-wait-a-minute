/**
 * Delegation policy reference for retrieval.
 * Determines when to use baseline vs CQE search.
 */

/**
 * Heuristic for when to search using baseline (ripgrep/GitGrep) vs CQE.
 * @param {Object} task - Task description object.
 * @param {string} task.text - The task text/prompt.
 * @param {string} [task.context] - Context for the task.
 * @param {string} [task.type] - Task type (e.g., 'coding', 'analysis').
 * @returns {{search:boolean,reason:string,scope:string}}
 */
export function shouldSearch(task) {
  const text = (task.text || '').toLowerCase();
  const context = (task.context || '').toLowerCase();
  const type = (task.type || '').toLowerCase();
  
  // Combined text for searching
  const searchText = `${text} ${context}`;

  // Skip if task explicitly asks for reasoning/analysis only
  // Check for reasoning/analysis keywords in the search text
  const reasoningPatterns = [
    'reasoning',
    'analysis',
    'synthesize',
    'reflect',
  ];
  const hasReasoning = reasoningPatterns.some(pattern => searchText.includes(pattern));
  
  if (hasReasoning) {
    return { 
      search: false, 
      reason: 'Pure reasoning task, no repository lookup needed', 
      scope: 'abstract' 
    };
  }

  // Special handling for contradiction detection (contradiction type tasks)
  if (/contradiction|conflict|inconsistent/i.test(searchText)) {
    return { 
      search: true, 
      reason: 'Contradiction detection requires evidence retrieval', 
      scope: 'evidence' 
    };
  }

  // Search for tasks referencing symbols, paths, file names, or error text
  const repoTerms = [
    'where is', 
    'defined in', 
    'located in', 
    'find', 
    'search for',
    'in file', 
    'path to', 
    'function',
    'class',
    'import',
    'export',
    'src/', 
    'lib/',
    './',
    '../',
    '.js',
    '.ts',
    '.md',
    'grep', 
    'git grep', 
    'ripgrep', 
    'file',
    'error',
  ];
  const hasRepoTerms = repoTerms.some(pattern => searchText.includes(pattern));

  // Skip if no repository terms
  if (!hasRepoTerms) {
    return { 
      search: false, 
      reason: 'No repository terms detected', 
      scope: 'abstract' 
    };
  }

  // Default: use search for symbol/locating tasks
  return { 
    search: true, 
    reason: 'Repository lookup needed for symbol/location task', 
    scope: 'evidence' 
  };
}

/**
 * Note about WAM's built-in shouldSearch behavior.
 * The WAM plugin does not have a native shouldSearch function.
 * This policy serves as a reference for tasks that would otherwise rely on repository lookup.
 */
export const REFERENCE_POLICY_NOTE = 'WAM has no built-in shouldSearch; this policy is provided for benchmark tasks that require evidence retrieval decisions.';
