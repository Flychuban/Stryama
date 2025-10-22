import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Lightbulb } from 'lucide-react';

interface ExamplePromptsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPrompt: (prompt: string) => void;
}

const examples = [
  {
    title: 'Todo List App',
    prompt:
      'Create a todo list application with dark mode support, task categories, priority levels, and the ability to mark tasks as complete.',
  },
  {
    title: 'Weather Dashboard',
    prompt:
      'Build a weather dashboard that shows current weather, 7-day forecast, and location search. Include temperature, humidity, and wind speed.',
  },
  {
    title: 'Recipe Finder',
    prompt:
      'Create a recipe search app where users can find recipes by ingredients, cuisine type, and dietary restrictions. Show cooking time and difficulty.',
  },
  {
    title: 'Expense Tracker',
    prompt:
      'Build an expense tracker with categories, monthly summaries, charts showing spending patterns, and the ability to export data as CSV.',
  },
  {
    title: 'Pomodoro Timer',
    prompt:
      'Create a Pomodoro timer with work/break intervals, customizable durations, session history, and notification sounds.',
  },
];

const ExamplePrompts = ({
  open,
  onOpenChange,
  onSelectPrompt,
}: ExamplePromptsProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/50 bg-background/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Lightbulb className="h-6 w-6 text-primary" />
            Example Prompts
          </DialogTitle>
          <DialogDescription>
            Get inspired by these example prompts to build your application
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 grid max-h-[60vh] gap-3 overflow-y-auto">
          {examples.map((example, index) => (
            <button
              key={index}
              onClick={() => onSelectPrompt(example.prompt)}
              className="group rounded-lg border border-border/50 p-4 text-left transition-all duration-300 hover:border-primary/50 hover:bg-accent/10"
            >
              <h4 className="mb-2 font-semibold transition-colors group-hover:text-primary">
                {example.title}
              </h4>
              <p className="text-sm text-muted-foreground">{example.prompt}</p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExamplePrompts;
