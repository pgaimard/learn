import { Controller, Get, Query } from '@nestjs/common';
import { SearchDto } from './search.dto.js';
import { SearchResults, SearchService } from './search.service.js';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() input: SearchDto): Promise<SearchResults> {
    return this.searchService.search(input.q);
  }
}
