import pandas as pd
import pickle
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASET_PATH = os.path.join(BASE_DIR, "dataset", "PhisingData.csv")
MODEL_PATH = os.path.join(BASE_DIR, "dataset", "phishguard_model.pkl")

# Load dataset
df = pd.read_csv(DATASET_PATH)

print("Columns:", df.columns)

# Features & label
X = df.drop("Result", axis=1)
y = df["Result"]

# Convert labels (-1 → 0, 1 → 1)
y = y.map({-1: 0, 1: 1})

# Train model
model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    class_weight="balanced"
)

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

model.fit(X_train, y_train)

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

# Save model
with open(MODEL_PATH, "wb") as model_file:
    pickle.dump(model, model_file)

print("Model trained successfully")
print(f"Test accuracy: {accuracy:.4f}")
print(f"Model saved to: {MODEL_PATH}")