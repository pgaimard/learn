import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ApiError } from '../http/api-error';
import { createOrderSaver } from './order-saver';

describe('createOrderSaver', () => {
  let requests: { order: string; response: Subject<void> }[];
  let saved: number;
  let errors: string[];
  let saveOrder: (order: string) => void;

  @Component({ template: '' })
  class Host {
    constructor() {
      saveOrder = createOrderSaver<string>(
        (order) => {
          const response = new Subject<void>();
          requests.push({ order, response });
          return response;
        },
        () => saved++,
        (error) => errors.push(...error.messages),
      );
    }
  }

  beforeEach(() => {
    requests = [];
    saved = 0;
    errors = [];
    TestBed.createComponent(Host);
  });

  function answer(index: number): void {
    requests[index].response.next();
    requests[index].response.complete();
  }

  it('n’envoie un ordre qu’une fois le précédent enregistré', () => {
    saveOrder('b,a,c');
    saveOrder('b,c,a');
    expect(requests.map((request) => request.order)).toEqual(['b,a,c']);

    answer(0);

    expect(requests.map((request) => request.order)).toEqual(['b,a,c', 'b,c,a']);
    answer(1);
    expect(saved).toBe(2);
  });

  it('signale un refus et continue avec les ordres suivants', () => {
    saveOrder('b,a');
    saveOrder('a,b');

    requests[0].response.error(new ApiError(400, ['Ordre refusé.']));

    expect(errors).toEqual(['Ordre refusé.']);
    expect(requests).toHaveLength(2);
  });
});
