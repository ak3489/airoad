export type TaskStatus = 'not_started' | 'in_progress' | 'review' | 'done';
export type PhaseStatus = 'locked' | 'active' | 'completed';

export interface PlanSummary {
  slug: string;
  name: string;
  roleTarget: string;
  summary: string;
  startDate: string;
  totalWeeks: number;
  dailyMinutes: number;
  currentWeek: number;
}

export interface TaskSummary {
  slug: string;
  title: string;
  objective: string;
  phaseSlug: string;
  phaseTitle: string;
  week: number;
  day: number;
  order: number;
  status: TaskStatus;
  priority: 'high' | 'normal' | 'low';
  optional: boolean;
  estimatedMinutes: number;
  actualMinutes: number;
  dueDate: string | null;
  tags: string[];
  stepTotal: number;
  stepDone: number;
  percent: number;
}

export interface PhaseProgress {
  slug: string;
  order: number;
  title: string;
  shortTitle: string;
  weeks: string;
  goal: string;
  percent: number;
  tasksDone: number;
  tasksTotal: number;
  status: PhaseStatus;
}

export interface Overview {
  plan: PlanSummary;
  phases: PhaseProgress[];
  activePhase: PhaseProgress | null;
  stats: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    reviewTasks: number;
    notStartedTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
  time: {
    totalMinutes: number;
    weekPlannedMinutes: number;
    weekActualMinutes: number;
    studyDays: number;
    streak: number;
  };
  today: {
    tasks: TaskSummary[];
    recommended: TaskSummary | null;
  };
  project: {
    slug: string;
    name: string;
    percent: number;
    milestonesDone: number;
    milestonesTotal: number;
    tasksDone: number;
    tasksTotal: number;
    nextTask: { slug: string; title: string } | null;
  } | null;
  recentRecords: {
    id: string;
    taskSlug: string;
    taskTitle: string;
    date: string;
    minutes: number;
    summary: string;
    createdAt: string | null;
  }[];
  openIssues: {
    id: string;
    title: string;
    kind: string;
    source: 'project' | 'note';
    taskSlug: string;
    createdAt: string | null;
  }[];
}

export interface StepPitfall {
  problem: string;
  solution: string;
}

export interface StepReferenceFile {
  filePath?: string;
  language: string;
  content: string;
}

export interface StepReference {
  approach: string;
  commands?: string[];
  files?: StepReferenceFile[];
  verify?: string[];
}

export interface TaskStep {
  key: string;
  order: number;
  title: string;
  goal: string;
  principle?: string;
  setup?: string;
  instructions: string;
  code?: { language: string; filePath?: string; content: string } | null;
  commands?: string[];
  expectedOutput?: string;
  pitfalls?: StepPitfall[];
  reference?: StepReference | null;
  acceptance: string[];
  status: 'todo' | 'done';
  resultLog?: string;
  errorLog?: string;
  notes?: string;
  completedAt?: string | null;
  locked: boolean;
}

export interface StatusEvent {
  status: TaskStatus;
  at: string;
  note?: string;
}

export interface LearningTask {
  _id: string;
  slug: string;
  phaseSlug: string;
  week: number;
  day: number;
  order: number;
  title: string;
  objective: string;
  problem: string;
  estimatedMinutes: number;
  status: TaskStatus;
  priority: 'high' | 'normal' | 'low';
  optional: boolean;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string;
  blockers: string;
  nextStep: string;
  tags: string[];
  acceptance: string[];
  resourceSlugs: string[];
  prerequisiteSlugs: string[];
  steps: TaskStep[];
  statusHistory: StatusEvent[];
}

export interface Phase {
  _id: string;
  slug: string;
  order: number;
  title: string;
  shortTitle: string;
  weeks: string;
  goal: string;
  why: string;
  knowledge: string[];
  prerequisites: string[];
  estimatedHours: number;
  deliverable: string;
  acceptance: string[];
  unlockCondition: string;
}

export interface Resource {
  _id: string;
  slug: string;
  title: string;
  url: string;
  kind: 'doc' | 'tutorial' | 'video' | 'repo' | 'article' | 'tool';
  topic: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  phaseSlug: string;
  importance: number;
  order: number;
  keyPoints: string[];
  status: 'unread' | 'reading' | 'done' | 'archived';
  notes: string;
  tags: string[];
  favorite: boolean;
  official: boolean;
  lastVerifiedAt: string | null;
  linkedTasks?: { slug: string; title: string; status: TaskStatus }[];
}

export interface LearningRecord {
  _id: string;
  taskSlug: string;
  stepKey?: string;
  date: string;
  minutes: number;
  summary: string;
  kind: string;
  createdAt: string | null;
}

export interface TaskDetail {
  task: LearningTask;
  phase: Phase;
  resources: Resource[];
  records: LearningRecord[];
  actualMinutes: number;
  previous: { slug: string; title: string } | null;
  next: { slug: string; title: string } | null;
  prerequisiteTasks: { slug: string; title: string; status: TaskStatus }[];
  statusLabels: Record<TaskStatus, string>;
}

export interface PlanResponse {
  plan: PlanSummary & { _id: string; status: string };
  phases: (Phase & {
    tasks: TaskSummary[];
    progress: PhaseProgress | null;
    evaluation: { result: string; score: number; evaluatedAt: string } | null;
  })[];
  totals: Overview['stats'];
}

export interface Note {
  _id: string;
  title: string;
  content: string;
  kind: 'note' | 'issue' | 'snippet' | 'summary' | 'interview';
  tags: string[];
  phaseSlug: string;
  taskSlug: string;
  resourceSlug: string;
  projectSlug: string;
  question: string;
  referenceAnswer: string;
  mastery: number;
  pinned: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Milestone {
  _id: string;
  slug: string;
  projectSlug: string;
  order: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  acceptance: string[];
  completedAt: string | null;
  tasks: ProjectTask[];
  tasksDone: number;
  tasksTotal: number;
  percent: number;
}

export interface ProjectTask {
  _id: string;
  slug: string;
  projectSlug: string;
  milestoneSlug: string;
  order: number;
  title: string;
  description: string;
  status: 'backlog' | 'doing' | 'review' | 'done';
  priority: 'high' | 'normal' | 'low';
  estimateHours: number;
  tags: string[];
  completedAt: string | null;
}

export interface Project {
  project: {
    _id: string;
    slug: string;
    name: string;
    goal: string;
    repoUrl: string;
    description: string;
    architecture: string;
    deployment: string;
    demo: string;
    status: string;
    techStack: string[];
    securityNotes: string;
    percent: number;
  };
  milestones: Milestone[];
  tasks: ProjectTask[];
  logs: {
    _id: string;
    projectSlug: string;
    type: 'decision' | 'issue' | 'test';
    title: string;
    content: string;
    status: 'open' | 'resolved';
    createdAt: string | null;
    updatedAt: string | null;
  }[];
  stats: {
    milestonesDone: number;
    milestonesTotal: number;
    tasksDone: number;
    tasksTotal: number;
    nextTask: ProjectTask | null;
  };
}

export interface WeeklyReview {
  _id: string;
  planSlug: string;
  week: number;
  status: 'draft' | 'final';
  plannedMinutes: number;
  actualMinutes: number;
  completedTaskSlugs: string[];
  newSkills: string;
  shipped: string;
  testResults: string;
  challenges: string;
  unfinished: string;
  nextWeekPlan: string;
  metricsSnapshot: {
    tasksTotal: number;
    tasksDone: number;
    tasksInProgress: number;
    recordsCount: number;
    notesCount: number;
    studyDays: number;
    actualMinutes: number;
    plannedMinutes: number;
  };
  createdAt: string | null;
  updatedAt: string | null;
}

export interface Settings {
  storage: { tasks: number; resources: number; notes: number; openIssues: number; mode: string };
  app: { name: string; version: string; environment: string };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string | null;
  streaming?: boolean;
  error?: boolean;
}

export interface ConversationSummary {
  id: string;
  title: string;
  scope: string;
  taskSlug: string;
  projectSlug: string;
  updatedAt: string | null;
  messageCount: number;
}

export interface SearchResults {
  tasks: { slug: string; title: string; phaseSlug: string; status: TaskStatus }[];
  resources: { slug: string; title: string; url: string }[];
  notes: { _id: string; title: string; kind: string }[];
  projectTasks: { slug: string; title: string; milestoneSlug: string }[];
}
