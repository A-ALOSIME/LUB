"use server";
import {retrievePublicSources,type SearchState} from "./client";
export async function searchKnowledge(_previous:SearchState,form:FormData):Promise<SearchState>{const question=form.get("question");return retrievePublicSources(typeof question==="string"?question:"");}
