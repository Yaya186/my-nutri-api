// app/(tabs)/food.tsx

import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity
} from 'react-native';

const encouragements = [
  "Tu fais déjà beaucoup. Respire 🌊",
  "Une assiette après l’autre 🦋",
  "Prendre soin de soi, c’est du courage 💙",
  "Tu es plus forte que tu ne le crois 🌌",
  "Pas à pas. Jour après jour. Et tu y arrives 🌀",
  "Merci d’avoir pris ce moment pour toi 🫧",
  "On avance, même doucement !",
  "Tu oses cuisiner pour te faire du bien 🧑‍🍳",
  "C’est beau de te voir persévérer ✨",
  "Une recette à la fois, un sourire à la fois 🙂",
  "Slowfit t’applaudit 👏",
  "C’est ton chemin, à ton rythme 🛤️",
  "Bravo pour aujourd’hui, vraiment 💫",
  "Ton corps mérite cette attention 💠",
  "Il n’y a pas de petit progrès 🚶",
  "Tu es en train de changer des choses 🧠",
  "Tu as ouvert l’app, et c’est déjà un pas 👣",
  "On fait équipe toi et moi 🤝",
  "Reviens demain, je serai là 💙",
  "Tu as bien mangé ? Bien joué 🏅",
  "L’amour de soi commence dans l’assiette 🍽️"
];

export default function FoodScreen() {
  const [ingredients, setIngredients] = useState('');
  const [image, setImage] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Modifiée pour accepter fromCamera
  const pickImage = async (fromCamera = false) => {
    let permission;
    if (fromCamera) {
      permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée pour accéder à l'appareil photo.");
        return;
      }
    } else {
      permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission refusée pour accéder à la galerie.");
        return;
      }
    }

    let result;
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({ base64: true });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ base64: true });
    }
    if (!result.canceled && result.assets?.[0]?.uri) {
      const uri = result.assets[0].uri;
      setImage(uri);
      extractTextFromImage(uri);
    }
  };

  // Fonction pour demander à l'utilisateur de choisir entre appareil photo et galerie pour l'analyse repas
  const pickPhotoForMealAnalysis = () => {
    Alert.alert(
      "Analyse ton repas",
      "Choisis une méthode pour ajouter une photo :",
      [
        {
          text: "📷 Prendre une photo",
          onPress: () => pickImage(true),
        },
        {
          text: "🖼️ Depuis la galerie",
          onPress: () => pickImage(false),
        },
        {
          text: "Annuler",
          style: "cancel",
        },
      ]
    );
  };

  const extractTextFromImage = async (uri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_CLOUD_VISION_API_KEY;
      if (!apiKey) throw new Error('Clé API Google non trouvée');

      const response = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [
              {
                image: { content: base64 },
                features: [{ type: 'TEXT_DETECTION' }],
              },
            ],
          }),
        }
      );

      const json = await response.json();
      const text = json.responses?.[0]?.fullTextAnnotation?.text || '';
      setIngredients(text);
      await saveIngredientsToHistory(text);
    } catch (err) {
      Alert.alert("Erreur OCR", err.message);
    }
  };

  // Sauvegarde les ingrédients extraits dans l'historique utilisateur
  const saveIngredientsToHistory = async (text) => {
    const ingredientsArray = text
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    for (const ingredient of ingredientsArray) {
      await fetch('https://vstmbgddopyihgwnmwen.supabase.co/rest/v1/user_ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          ingredient,
        }),
      });
    }
  };

  const getRecipes = async () => {
    try {
      setLoading(true);
      const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      if (!apiKey) throw new Error('Clé API OpenAI non trouvée');

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'system',
              content:
                'Tu es un nutritionniste. Propose 5 recettes saines, hypocaloriques, riches en protéines, à IG bas, à partir des ingrédients suivants. Réponds avec des titres et résumés de recettes.',
            },
            {
              role: 'user',
              content: `Ingrédients disponibles : ${ingredients}`,
            },
          ],
        }),
      });

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      if (!text) throw new Error('Pas de réponse reçue');
      setRecipes(text.split(/\n(?=\d\.)/));
    } catch (err) {
      Alert.alert('Erreur API', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Ajouter des ingrédients manquants à la liste de courses
  const addToShoppingList = async (missingIngredients: string[]) => {
    for (const ingredient of missingIngredients) {
      await fetch('https://vstmbgddopyihgwnmwen.supabase.co/rest/v1/shopping_list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          ingredient,
          added_by: 'IA',
          status: 'pending',
        }),
      });
    }
    Alert.alert('🛒 Liste mise à jour', 'Les ingrédients manquants ont été ajoutés.');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require('./assets/images/nutritionist.png')} style={styles.avatar} />
        <Text style={styles.header}>Ton nutritionniste</Text>

        <TextInput
          style={styles.input}
          placeholder="Écris ce que tu as dans ton frigo, tes placards…"
          value={ingredients}
          onChangeText={setIngredients}
          multiline
        />

        <TouchableOpacity style={styles.button} onPress={() => pickImage(true)}>
          <Text style={styles.buttonText}>📸 Prendre une photo</Text>
        </TouchableOpacity>

        <Text style={styles.subtext}>(frigo, placards, produits…)</Text>

        <Text style={styles.sectionTitle}>Reste aujourd’hui</Text>
        <Text style={styles.subtitle}> 850 kcal – 45g prot. 20g gluc.</Text>

        <TouchableOpacity
          style={[styles.button, !ingredients.trim() && styles.buttonDisabled]}
          onPress={getRecipes}
          disabled={!ingredients.trim()}
        >
          <Text style={styles.buttonText}>🔍 Trouver des recettes</Text>
        </TouchableOpacity>

        {/* Affichage des recettes ici si besoin */}
        {/* Exemple d'affichage des recettes générées */}
        {recipes && Array.isArray(recipes) && recipes.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recettes proposées</Text>
            {recipes.map((r, idx) => (
              <ScrollView
                key={idx}
                horizontal={false}
                style={styles.recipeCard}
                contentContainerStyle={{ flexGrow: 1 }}
              >
                <Text style={styles.recipeText}>{r}</Text>
              </ScrollView>
            ))}
            {/* Bouton pour ajouter à la liste de courses */}
            <TouchableOpacity
              style={styles.button}
              onPress={() => addToShoppingList(['œufs', 'lait', 'courgette'])} // à remplacer par analyse réelle plus tard
            >
              <Text style={styles.buttonText}>🛒 Ajouter à ma liste de courses</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.sectionTitle}>Analyse tes repas</Text>

        <TouchableOpacity style={styles.buttonAlt} onPress={pickPhotoForMealAnalysis}>
          <Text style={styles.buttonText}>📷 Prends une photo de ce que j’ai mangé</Text>
        </TouchableOpacity>

        <Text style={styles.encouragement}>
          {encouragements[Math.floor(Math.random() * encouragements.length)]}
        </Text>

        <TouchableOpacity style={styles.buttonAlt} onPress={() => router.push('/mes-courses')}>
          <Text style={styles.buttonText}>🛒 Voir ma liste de courses</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    backgroundColor: '#fdfdfd',
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    color: '#333',
  },
  input: {
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    minHeight: 60,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonDisabled: {
    backgroundColor: '#93C5FD',
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  image: {
    width: '100%',
    height: 200,
    marginVertical: 12,
    borderRadius: 12,
  },
  recipeCard: {
    backgroundColor: '#f2f2f2',
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  recipeText: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
  },
  encouragement: {
    marginTop: 24,
    marginBottom: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignSelf: 'center',
    marginTop: 36,
    marginBottom: 8,
  },
  header: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#111',
  },
  subtext: {
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
    color: '#222',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  buttonAlt: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
});
