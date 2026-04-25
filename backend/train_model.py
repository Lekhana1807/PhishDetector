import pandas as pd
import pickle
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

# Load dataset
df = pd.read_csv("../dataset/PhisingData.csv")

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

# Save model
pickle.dump(model, open("../dataset/phishguard_model.pkl", "wb"))

print("Model trained successfully")