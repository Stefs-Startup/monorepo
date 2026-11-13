# Angular Enterprise: Reactive Forms & Custom Controls (`ControlValueAccessor`)

Angular Reactive Forms provide a synchronous, immutable, and testable model for managing form state, validation, and submission payloads in enterprise applications.

---

## 📋 1. Reactive Forms Core Architecture

Reactive Forms build an explicit object graph of `FormControl`, `FormGroup`, and `FormArray` instances.

```
                               ┌───────────────────────────┐
                               │  FormGroup (UserForm)     │
                               └─────────────┬─────────────┘
                                             │
             ┌───────────────────────────────┴───────────────────────────────┐
             ▼                                                               ▼
┌──────────────────────────┐                                   ┌──────────────────────────┐
│ FormControl (email)      │                                   │ FormArray (addresses)    │
└──────────────────────────┘                                   └─────────────┬────────────┘
                                                                             │
                                                               ┌─────────────┴────────────┐
                                                               ▼                          ▼
                                                  ┌────────────────────────┐ ┌────────────────────────┐
                                                  │ FormGroup (Address #1) │ │ FormGroup (Address #2) │
                                                  └────────────────────────┘ └────────────────────────┘
```

### Typed Reactive Forms Example

```typescript
import { Component, inject } from '@angular/core';
import { FormBuilder, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';

@Component({
  selector: 'app-user-profile-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="profileForm" (ngSubmit)="onSubmit()">
      <input formControlName="username" placeholder="Username" />
      <input formControlName="email" placeholder="Email" />

      <div formArrayName="phoneNumbers">
        <div *ngFor="let phone of phoneNumbers.controls; let i = index">
          <input [formControlName]="i" placeholder="Phone Number" />
        </div>
      </div>

      <button type="submit" [disabled]="profileForm.invalid">Save Profile</button>
    </form>
  `
})
export class UserProfileFormComponent {
  private fb = inject(FormBuilder);

  // Strongly-Typed Form Definition
  public profileForm = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumbers: this.fb.array([
      this.fb.control('', Validators.required)
    ])
  });

  get phoneNumbers(): FormArray {
    return this.profileForm.get('phoneNumbers') as FormArray;
  }

  onSubmit() {
    if (this.profileForm.valid) {
      // Raw value extracts exact typed JS object without undefined keys
      const payload = this.profileForm.getRawValue();
      console.log('Submitting payload:', payload);
    }
  }
}
```

---

## 🎛️ 2. Custom Form Controls via `ControlValueAccessor` (CVA)

In enterprise design systems, native `<input>` elements are insufficient. Custom components (e.g. Star Ratings, Tag Inputs, Rich Select Pickers, Custom Toggle Switches) MUST integrate seamlessly with `formControlName` and `[(ngModel)]`.

This is achieved by implementing the `ControlValueAccessor` interface.

### The 4 Mandatory `ControlValueAccessor` Methods

1.  **`writeValue(value: any)`**: Angular calls this to push a new value from the form model into your custom DOM view component.
2.  **`registerOnChange(fn: any)`**: Registers a callback function `fn` that your component MUST call whenever the user changes the UI control value.
3.  **`registerOnTouched(fn: any)`**: Registers a callback function `fn` that your component MUST call when the control loses focus (`blur`).
4.  **`setDisabledState(isDisabled: boolean)`**: Angular calls this when the parent form control changes state between enabled/disabled.

---

### Production `ControlValueAccessor` Blueprint: Custom Star Rating Control

```typescript
import { Component, forwardRef, ChangeDetectionStrategy, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-star-rating',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true // MANDATORY: Adds component to global NG_VALUE_ACCESSOR token array!
    }
  ],
  template: `
    <div class="star-rating" [class.disabled]="disabled()">
      <span
        *ngFor="let star of [1, 2, 3, 4, 5]"
        class="star"
        [class.active]="star <= value()"
        (click)="selectRating(star)"
      >
        ★
      </span>
    </div>
  `,
  styles: [`
    .star { cursor: pointer; font-size: 1.5rem; color: #ccc; }
    .star.active { color: #ffc107; }
    .disabled { opacity: 0.5; pointer-events: none; }
  `]
})
export class StarRatingComponent implements ControlValueAccessor {
  public value = signal<number>(0);
  public disabled = signal<boolean>(false);

  // Callbacks registered by Angular's Forms API
  private onChange: (val: number) => void = () => {};
  private onTouched: () => void = () => {};

  // 1. Angular -> Component
  writeValue(val: number): void {
    this.value.set(val || 0);
  }

  // 2. Register Change Callback
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  // 3. Register Touched Callback
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  // 4. Handle Disabled State
  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  // User interaction event
  selectRating(rating: number): void {
    if (!this.disabled()) {
      this.value.set(rating);
      this.onChange(rating);   // Notify Angular Form Control of value update!
      this.onTouched();          // Mark control as touched!
    }
  }
}
```

#### Consumer Usage in Parent Form:

```html
<form [formGroup]="reviewForm">
  <!-- Binds seamlessly as if it were a native input element! -->
  <lib-star-rating formControlName="rating"></lib-star-rating>
</form>
```

---

## 🧪 3. Advanced Validation: Cross-Field & Async Validation

### Cross-Field Validation (Password Match)

Cross-field validation operates on the `FormGroup` level:

```typescript
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordMismatch: true };
};

// Usage on FormGroup:
this.fb.group({
  password: ['', Validators.required],
  confirmPassword: ['', Validators.required]
}, { validators: passwordMatchValidator });
```

---

### Asynchronous Validation (Username Availability Check)

```typescript
import { Injectable, inject } from '@angular/core';
import { AsyncValidator, AbstractControl, ValidationErrors } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UniqueUsernameValidator implements AsyncValidator {
  private http = inject(HttpClient);

  validate(control: AbstractControl): Observable<ValidationErrors | null> {
    return timer(400).pipe( // Debounce async API calls!
      switchMap(() => this.http.get<{ available: boolean }>(`/api/v1/users/check-username?q=${control.value}`)),
      map(res => (res.available ? null : { usernameTaken: true })),
      catchError(() => of(null))
    );
  }
}
```
