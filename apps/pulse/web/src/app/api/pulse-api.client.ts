import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { operations } from './generated/pulse-api.types';

type JsonResponse200<
  Op extends { responses: { 200: { content: { 'application/json': unknown } } } }
> = Op['responses'][200]['content']['application/json'];

type JsonRequestBody<
  Op extends { requestBody: { content: { 'application/json': unknown } } }
> = Op['requestBody']['content']['application/json'];

export type PulseStateApiResponse = JsonResponse200<operations['getPulseState']>;
export type TriageTaskApiRequest = JsonRequestBody<operations['triageTask']>;
export type SwapTop3ApiRequest = JsonRequestBody<operations['swapTop3']>;
export type SendChatMessageApiRequest = JsonRequestBody<operations['sendChatMessage']>;
export type UpdateSettingsApiRequest = JsonRequestBody<operations['updateSettings']>;

/**
 * Contract-typed Angular HttpClient wrapper bound directly to generated OpenAPI 3.1 operations.
 * Preserves Angular's HttpClient/HttpInterceptor pipeline with zero generated runtime bloat.
 */
@Injectable({ providedIn: 'root' })
export class PulseApiClient {
  private readonly http = inject(HttpClient);
  private readonly apiBase = '/api/v1/pulse';

  getState(): Observable<PulseStateApiResponse> {
    return this.http.get<PulseStateApiResponse>(`${this.apiBase}/state`);
  }

  triageTask(taskId: string, body: TriageTaskApiRequest): Observable<PulseStateApiResponse> {
    return this.http.post<PulseStateApiResponse>(
      `${this.apiBase}/tasks/${encodeURIComponent(taskId)}/triage`,
      body
    );
  }

  swapTop3(body: SwapTop3ApiRequest): Observable<PulseStateApiResponse> {
    return this.http.post<PulseStateApiResponse>(`${this.apiBase}/tasks/swap`, body);
  }

  sendChatMessage(
    taskId: string,
    body: SendChatMessageApiRequest
  ): Observable<PulseStateApiResponse> {
    return this.http.post<PulseStateApiResponse>(
      `${this.apiBase}/tasks/${encodeURIComponent(taskId)}/chat`,
      body
    );
  }

  updateSettings(body: UpdateSettingsApiRequest): Observable<PulseStateApiResponse> {
    return this.http.put<PulseStateApiResponse>(`${this.apiBase}/settings`, body);
  }

  resetDemo(): Observable<PulseStateApiResponse> {
    return this.http.post<PulseStateApiResponse>(`${this.apiBase}/demo/reset`, {});
  }
}
