import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Exception explicite à la garde globale : la route est accessible sans session.
export const Public = (): CustomDecorator => SetMetadata(IS_PUBLIC_KEY, true);
