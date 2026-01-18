# Frontend Design Standards

Standards for building maintainable, performant frontend applications.

## Component Architecture

### Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI primitives
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   └── Input/
│   ├── features/        # Feature-specific components
│   │   ├── auth/
│   │   └── dashboard/
│   └── layouts/         # Layout components
├── hooks/               # Custom hooks
├── lib/                 # Utilities and helpers
├── services/            # API calls
├── stores/              # State management
└── types/               # TypeScript types
```

### Component Design

```tsx
// Single responsibility
// Good: One purpose
function UserAvatar({ user, size }) {
  return <img src={user.avatarUrl} className={sizes[size]} />;
}

// Bad: Too many concerns
function UserCard({ user }) {
  // Fetching, display, actions all in one
}

// Composition over configuration
// Good: Composable
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Bad: Prop explosion
<Card
  title="Title"
  showHeader={true}
  headerIcon={<Icon />}
  content="Content"
  showFooter={false}
/>
```

## State Management

### Local State (useState)

```tsx
// Simple, component-specific state
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>{count}</button>;
}
```

### Server State (React Query)

```tsx
// Data from API
function UserProfile({ userId }) {
  const {
    data: user,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["user", userId],
    queryFn: () => fetchUser(userId),
  });

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;
  return <Profile user={user} />;
}

// Mutations
function UpdateProfile() {
  const mutation = useMutation({
    mutationFn: updateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(formData);
      }}
    >
      {/* form fields */}
    </form>
  );
}
```

### Global State (Zustand)

```tsx
// App-wide state
const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  login: (user) => set({ user, isAuthenticated: true }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

// Usage
function Header() {
  const { user, logout } = useAuthStore();
  return <nav>{user && <button onClick={logout}>Logout</button>}</nav>;
}
```

## Hooks

### Custom Hook Pattern

```tsx
// Encapsulate reusable logic
function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

// Usage
function Settings() {
  const [theme, setTheme] = useLocalStorage("theme", "light");
}
```

### Hook Rules

1. Only call at top level
2. Only call from React functions
3. Name with "use" prefix
4. Return consistent shapes

## Error Handling

### Error Boundaries

```tsx
class ErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>;
```

### Async Error Handling

```tsx
function UserList() {
  const { data, error, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  if (isLoading) return <Skeleton count={5} />;

  if (error) {
    return (
      <ErrorMessage
        title="Failed to load users"
        message={error.message}
        retry={() => refetch()}
      />
    );
  }

  return <UserTable users={data} />;
}
```

## Performance

### Memoization

```tsx
// Expensive calculations
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items],
);

// Callback stability
const handleClick = useCallback((id: string) => selectItem(id), [selectItem]);

// Component memoization
const ExpensiveComponent = memo(function Expensive({ data }) {
  // Complex rendering
});
```

### Code Splitting

```tsx
// Lazy load routes/components
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Settings = lazy(() => import("./pages/Settings"));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### List Virtualization

```tsx
import { useVirtualizer } from "@tanstack/react-virtual";

function VirtualList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: 400, overflow: "auto" }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: "absolute",
              top: 0,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {items[virtualItem.index]}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Forms

### Form Handling (React Hook Form)

```tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
});

type FormData = z.infer<typeof schema>;

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    await login(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register("email")} error={errors.email?.message} />
      <Input
        {...register("password")}
        type="password"
        error={errors.password?.message}
      />
      <Button type="submit" loading={isSubmitting}>
        Login
      </Button>
    </form>
  );
}
```

## Styling

### Tailwind CSS (Recommended)

```tsx
// Utility-first
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</button>;

// Component variants with cva
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("px-4 py-2 rounded font-medium transition-colors", {
  variants: {
    variant: {
      primary: "bg-blue-500 text-white hover:bg-blue-600",
      secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300",
      outline: "border border-gray-300 hover:bg-gray-50",
    },
    size: {
      sm: "px-3 py-1 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-3 text-lg",
    },
  },
  defaultVariants: {
    variant: "primary",
    size: "md",
  },
});

interface ButtonProps extends VariantProps<typeof buttonVariants> {
  children: React.ReactNode;
}

function Button({ variant, size, children }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size })}>{children}</button>
  );
}
```

## Testing

### Component Tests

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "./LoginForm";

describe("LoginForm", () => {
  it("submits with valid data", async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/email/i), "test@test.com");
    await userEvent.type(screen.getByLabelText(/password/i), "password123");
    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "password123",
    });
  });

  it("shows validation errors", async () => {
    render(<LoginForm onSubmit={jest.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: /login/i }));

    expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
  });
});
```

## Checklist

Before shipping:

- [ ] Components are properly typed
- [ ] Error states handled
- [ ] Loading states present
- [ ] Empty states designed
- [ ] Forms validated
- [ ] Accessibility tested
- [ ] Performance optimized
- [ ] Tests written
