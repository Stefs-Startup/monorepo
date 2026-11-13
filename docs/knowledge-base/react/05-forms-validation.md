# React Enterprise: Forms, Validation & Controlled vs Uncontrolled Mechanics

Form management in React applications balances re-render performance, accessibility, state synchronization, and schema-driven validation (React Hook Form + Zod).

---

## 📝 1. Controlled vs Uncontrolled Form Inputs

```
Controlled Component                                   Uncontrolled Component
┌─────────────────────────────────────────────┐        ┌─────────────────────────────────────────────┐
│ Component state (`useState`) drives input    │        │ Browser DOM holds field value               │
│ Re-renders on every keystroke (`onChange`)   │        │ Read on submit via DOM `ref` (`useRef`)     │
│ Instant inline validation                    │        │ Zero re-renders during typing               │
└─────────────────────────────────────────────┘        └─────────────────────────────────────────────┘
```

---

## 🛡️ 2. Production Form Blueprint: React Hook Form + Zod Schema

**React Hook Form** uses uncontrolled components backed by `ref` registration, yielding minimal re-renders while delivering type-safe validation via **Zod**.

```tsx
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 1. Define Validation Schema with Zod
export const UserRegistrationSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export type UserRegistrationInput = z.infer<typeof UserRegistrationSchema>;

// 2. Component Implementation
export function RegistrationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserRegistrationInput>({
    resolver: zodResolver(UserRegistrationSchema),
    mode: 'onTouched',
  });

  const onSubmit = async (data: UserRegistrationInput) => {
    await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label>Username</label>
        <input {...register('username')} />
        {errors.username && <span className="error">{errors.username.message}</span>}
      </div>

      <div>
        <label>Email</label>
        <input type="email" {...register('email')} />
        {errors.email && <span className="error">{errors.email.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Registering...' : 'Submit'}
      </button>
    </form>
  );
}
```

---

## 🔄 3. Cross-Framework Rosetta Stone: Forms & Validation

| Form Concept | React (React Hook Form + Zod) | Angular (Reactive Forms) |
| :--- | :--- | :--- |
| **Form Model** | Uncontrolled DOM refs + Zod Schema | `FormGroup` / `FormControl` instance tree |
| **Schema Validation** | `zodResolver(Schema)` | Custom `ValidatorFn` / `AsyncValidatorFn` |
| **Field Binding** | `<input {...register('fieldName')} />` | `<input formControlName="fieldName" />` |
| **Custom Control Interface** | `<Controller name="..." control={control} render={...} />` | `ControlValueAccessor` (CVA interface) |
