from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import re

app = FastAPI()

# Autoriser les requêtes venant de ton app mobile
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class OCRInput(BaseModel):
    text: str

KNOWN_INGREDIENTS = {
    "oeufs", "fromage", "poulet", "tomate", "riz", "carotte", "thon", "avocat", "haricots", "courgette",
    "aubergine", "pomme", "banane", "lait", "farine", "sucre", "yaourt", "crevette", "poisson", "boeuf", "jambon"
}

def extract_ingredients_from_text(text: str) -> List[str]:
    words = re.findall(r"\b[a-zA-Zéèêàçûîôùïëäü\-]{3,}\b", text.lower())
    detected = list(set(word for word in words if word in KNOWN_INGREDIENTS))
    return detected

@app.post("/filter-ingredients")
async def filter_ingredients(input: OCRInput):
    ingredients = extract_ingredients_from_text(input.text)
    return {"ingredients": ingredients}


# --- Bloc pour génération de recette via OpenAI ---
from openai import OpenAI
import os

class RecipeRequest(BaseModel):
    ingredients: List[str]
    calories: int = 800  # valeur par défaut

def call_openai(prompt: str) -> str:
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "Tu es un nutritionniste expert."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=500
    )
    return response.choices[0].message.content.strip()

@app.post("/generate-recipe")
async def generate_recipe(input: RecipeRequest):
    prompt = (
        f"Propose une recette simple et rapide avec les ingrédients suivants : {', '.join(input.ingredients)}. "
        f"Respecte une limite de {input.calories} kcal. Donne-moi les étapes de préparation et les valeurs nutritionnelles approximatives."
    )
    suggestion = call_openai(prompt)
    return {"recipe": suggestion}